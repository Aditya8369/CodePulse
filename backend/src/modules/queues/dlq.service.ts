import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, UnrecoverableError } from 'bullmq';
import { createHash } from 'node:crypto';
import { hostname } from 'node:os';
import axios from 'axios';
import { RETRY_POLICY, SOURCE_QUEUES } from './queue-policy';

interface Quarantine {
  sourceQueue: string;
  sourceId: string;
  name: string;
  payload: unknown;
  error: string;
  stack: string;
  failedAt: string;
  host: string;
}
const METRIC = '{codepulse-dlq}:total';
const MARKERS = '{codepulse-dlq}:counted';
const COUNT_ONCE =
  "if redis.call('SADD', KEYS[1], ARGV[1]) == 1 then redis.call('INCR', KEYS[2]); return 1 end; return 0";
@Injectable()
export class DeadLetterQueueService {
  private readonly logger = new Logger(DeadLetterQueueService.name);
  private readonly sources: Map<string, Queue>;
  constructor(
    @InjectQueue('dead-letter') private readonly dead: Queue,
    @InjectQueue('challenges') challenges: Queue,
    @InjectQueue('leaderboard-sync') leaderboard: Queue,
    @InjectQueue('github-sync') sync: Queue,
    private readonly config: ConfigService,
  ) {
    this.sources = new Map([
      ['challenges', challenges],
      ['leaderboard-sync', leaderboard],
      ['github-sync', sync],
    ]);
  }
  async recordFailedJob(jobInfo: any): Promise<void> {
    this.logger.warn(`DLQ recorded failed job: ${jobInfo?.id || 'unknown'}`);
  }

  async capture(job: Job | undefined, error: Error): Promise<void> {
    if (!job?.id || !this.sources.has(job.queueName)) return;
    if (
      !(error instanceof UnrecoverableError) &&
      job.attemptsMade < (job.opts.attempts ?? 1)
    )
      return;
    try {
      const encoded = JSON.stringify(job.data);
      if (!encoded || Buffer.byteLength(encoded) > 1024 * 1024)
        throw new Error('Invalid quarantine payload');
      const id = createHash('sha256')
        .update(JSON.stringify([job.queueName, job.id]))
        .digest('hex');
      const data: Quarantine = {
        sourceQueue: job.queueName,
        sourceId: job.id,
        name: job.name,
        payload: JSON.parse(encoded) as unknown,
        error: error.message.slice(0, 4096),
        stack: (error.stack ?? '').slice(0, 32768),
        failedAt: new Date().toISOString(),
        host: hostname(),
      };
      await this.dead.add('quarantined', data, {
        jobId: id,
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      });
      const client = await this.dead.client;
      client.defineCommand('codepulseCountDlq', {
        numberOfKeys: 2,
        lua: COUNT_ONCE,
      });
      // Supports BullMQ's new Redis adapter and its earlier raw ioredis client.
      const commands = client as unknown as {
        runCommand?: (name: string, args: string[]) => Promise<unknown>;
        codepulseCountDlq?: (...args: string[]) => Promise<unknown>;
      };
      const counted = commands.runCommand
        ? await commands.runCommand('codepulseCountDlq', [MARKERS, METRIC, id])
        : await commands.codepulseCountDlq!(MARKERS, METRIC, id);
      if (Number(counted) === 1) await this.alert(id, data);
      // Source remains failed and retained, even if quarantine storage fails.
    } catch {
      this.logger.error(
        'Quarantine failed; original failed job remains in its source queue.',
      );
    }
  }
  private async alert(id: string, data: Quarantine) {
    const url = this.config.get<string>('DLQ_DISCORD_WEBHOOK_URL');
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (
        parsed.protocol !== 'https:' ||
        parsed.hostname !== 'discord.com' ||
        !parsed.pathname.startsWith('/api/webhooks/')
      )
        throw new Error('Invalid destination');
      // Raw payload/error can contain access tokens. Never send them to Discord.
      await axios.post(
        url,
        {
          allowed_mentions: { parse: [] },
          embeds: [
            {
              title: 'CodePulse job quarantined',
              description:
                'Retry budget exhausted or unrecoverable job. Inspect the protected DLQ record.',
              fields: [
                { name: 'Queue', value: data.sourceQueue },
                { name: 'Job', value: data.name.slice(0, 200) },
                { name: 'DLQ id', value: id },
                { name: 'Worker', value: data.host.slice(0, 200) },
                {
                  name: 'Arguments / error',
                  value: 'Redacted; inspect protected Redis.',
                },
              ],
              timestamp: data.failedAt,
            },
          ],
        },
        { timeout: 5000, maxRedirects: 0 },
      );
    } catch {
      this.logger.warn('Optional Discord alert failed; quarantine retained.');
    }
  }
  async replay(ids: unknown) {
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.length > 20 ||
      ids.some((id) => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id))
    )
      throw new BadRequestException('Provide 1–20 hexadecimal DLQ ids.');
    const results: { id: string; status: string; replayJobId?: string }[] = [];
    for (const id of [...new Set(ids as string[])]) {
      try {
        const entry = await this.dead.getJob(id);
        if (!entry) {
          results.push({ id, status: 'not_found' });
          continue;
        }
        const data = entry.data as Quarantine;
        if (
          !data ||
          !SOURCE_QUEUES.includes(
            data.sourceQueue as (typeof SOURCE_QUEUES)[number],
          ) ||
          !data.name ||
          !data.sourceId
        ) {
          results.push({ id, status: 'invalid_record' });
          continue;
        }
        const replayJobId = `dlq-replay-${id}`;
        // BullMQ's stable job id plus retained completion prevents duplicate replay execution.
        await this.sources.get(data.sourceQueue)!.add(data.name, data.payload, {
          ...RETRY_POLICY,
          jobId: replayJobId,
          removeOnComplete: false,
        });
        results.push({ id, status: 'submitted_or_existing', replayJobId });
      } catch {
        results.push({ id, status: 'failed_retry_later' });
      }
    }
    return { results };
  }
  async metrics() {
    const raw = await (await this.dead.client).get(METRIC);
    const count = raw && /^\d+$/.test(raw) ? raw : '0';
    return (
      '# HELP bullmq_dead_letter_jobs_total Unique terminal source jobs quarantined.\n# TYPE bullmq_dead_letter_jobs_total counter\nbullmq_dead_letter_jobs_total ' +
      count +
      '\n'
    );
  }
}
