import axios from 'axios';
import { Job, Queue, UnrecoverableError } from 'bullmq';
import type { ConfigService } from '@nestjs/config';
import { DeadLetterQueueService } from './dlq.service';
const ID = 'a'.repeat(64);
const record = {
  sourceQueue: 'github-sync',
  sourceId: 'source',
  name: 'sync-user',
  payload: { userId: 'u' },
};
function setup(webhook?: string) {
  const client = {
    defineCommand: jest.fn(),
    runCommand: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue('12'),
  };
  const dead = {
    add: jest.fn().mockResolvedValue({ id: ID }),
    getJob: jest.fn().mockResolvedValue({ data: record }),
    client: Promise.resolve(client),
  };
  const source = { add: jest.fn().mockResolvedValue({}) };
  const service = new DeadLetterQueueService(
    dead as unknown as Queue,
    source as unknown as Queue,
    source as unknown as Queue,
    source as unknown as Queue,
    { get: jest.fn().mockReturnValue(webhook) } as unknown as ConfigService,
  );
  return { service, client, dead, source };
}
function job(attemptsMade = 3, patch = {}) {
  return {
    id: 'source',
    queueName: 'github-sync',
    name: 'sync-user',
    data: { userId: 'u', overrideToken: 'secret-value' },
    attemptsMade,
    opts: { attempts: 3 },
    ...patch,
  } as unknown as Job;
}
describe('terminal-failure quarantine and recovery', () => {
  afterEach(() => jest.restoreAllMocks());
  it('supports the legacy raw ioredis named-command interface', async () => {
    const { service, client } = setup();
    const named = jest.fn().mockResolvedValue(1);
    Object.assign(client, { runCommand: undefined, codepulseCountDlq: named });
    await service.capture(job(), new Error('terminal'));
    expect(named).toHaveBeenCalledWith(
      '{codepulse-dlq}:counted',
      '{codepulse-dlq}:total',
      expect.any(String),
    );
  });
  it('ignores retryable attempts and quarantines only after exhaustion', async () => {
    const { service, dead, client } = setup();
    await service.capture(job(1), new Error('temporary'));
    await service.capture(job(2), new Error('temporary'));
    expect(dead.add).not.toHaveBeenCalled();
    await service.capture(job(3), new Error('exhausted'));
    expect(dead.add).toHaveBeenCalledWith(
      'quarantined',
      expect.objectContaining({
        ...record,
        payload: { userId: 'u', overrideToken: 'secret-value' },
        error: 'exhausted',
        failedAt: expect.any(String),
        stack: expect.any(String),
      }),
      expect.objectContaining({
        jobId: expect.stringMatching(/^[a-f0-9]{64}$/),
        attempts: 1,
        removeOnFail: false,
      }),
    );
    expect(client.runCommand).toHaveBeenCalledTimes(1);
  });
  it('quarantines explicitly unrecoverable failures without waiting for attempts', async () => {
    const { service, dead } = setup();
    await service.capture(job(1), new UnrecoverableError('bad payload'));
    expect(dead.add).toHaveBeenCalledTimes(1);
  });
  it('ignores missing and foreign queue jobs', async () => {
    const { service, dead } = setup();
    await service.capture(undefined, new Error('missing'));
    await service.capture(
      job(3, { queueName: 'untrusted-queue' }),
      new Error('unknown'),
    );
    expect(dead.add).not.toHaveBeenCalled();
  });
  it('uses stable quarantine ids and sends one redacted alert across repeated events', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValue({});
    const { service, dead, client } = setup(
      'https://discord.com/api/webhooks/test/test',
    );
    client.runCommand.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    await service.capture(job(), new Error('token=secret-value'));
    await service.capture(job(), new Error('token=secret-value'));
    expect(dead.add.mock.calls[0][2].jobId).toBe(
      dead.add.mock.calls[1][2].jobId,
    );
    expect(post).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(post.mock.calls[0][1])).not.toContain('secret-value');
    expect(post.mock.calls[0][2]).toMatchObject({
      timeout: 5000,
      maxRedirects: 0,
    });
  });
  it('retains quarantines when alerts fail and refuses arbitrary alert destinations', async () => {
    const post = jest
      .spyOn(axios, 'post')
      .mockRejectedValue(new Error('offline'));
    const { service, dead } = setup(
      'https://discord.com/api/webhooks/test/test',
    );
    await expect(
      service.capture(job(), new Error('failed')),
    ).resolves.toBeUndefined();
    expect(dead.add).toHaveBeenCalledTimes(1);
    await setup('http://localhost/secret').service.capture(
      job(),
      new Error('failed'),
    );
    expect(post).toHaveBeenCalledTimes(1);
  });
  it('never throws from the worker event on poison payloads or quarantine outages', async () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const { service, dead } = setup();
    await service.capture(job(3, { data: cyclic }), new Error('failed'));
    expect(dead.add).not.toHaveBeenCalled();
    dead.add.mockRejectedValueOnce(new Error('redis down'));
    await expect(
      service.capture(job(), new Error('failed')),
    ).resolves.toBeUndefined();
  });
  it('replays deduplicated ids with a stable source job id and full retry budget', async () => {
    const { service, source } = setup();
    await service.replay([ID, ID]);
    await service.replay([ID]);
    expect(source.add).toHaveBeenCalledTimes(2);
    expect(source.add).toHaveBeenLastCalledWith(
      'sync-user',
      { userId: 'u' },
      expect.objectContaining({
        jobId: `dlq-replay-${ID}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: false,
      }),
    );
  });
  it('rejects unbounded/invalid replay input before reading Redis', async () => {
    const { service, dead } = setup();
    for (const input of [[], ['bad'], Array(21).fill(ID), 'all', undefined])
      await expect(service.replay(input)).rejects.toThrow();
    expect(dead.getJob).not.toHaveBeenCalled();
  });
  it('isolates missing, forged and failed entries without exposing payloads', async () => {
    const { service, dead, source } = setup();
    dead.getJob
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ data: { ...record, sourceQueue: 'arbitrary' } });
    const result = await service.replay([ID, 'b'.repeat(64)]);
    expect(result.results.map((r) => r.status)).toEqual([
      'not_found',
      'invalid_record',
    ]);
    expect(source.add).not.toHaveBeenCalled();
    source.add.mockRejectedValueOnce(new Error('offline'));
    expect((await service.replay([ID])).results[0].status).toBe(
      'failed_retry_later',
    );
  });
  it('exposes a persisted Prometheus counter with a safe zero fallback', async () => {
    const { service, client } = setup();
    expect(await service.metrics()).toContain(
      'bullmq_dead_letter_jobs_total 12\n',
    );
    client.get.mockResolvedValueOnce('NaN');
    expect(await service.metrics()).toContain(
      'bullmq_dead_letter_jobs_total 0\n',
    );
  });
});
