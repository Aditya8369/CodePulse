import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';

export type WalCommand =
  | 'BATTLE_START'
  | 'SUBMISSION'
  | 'POWER_UP'
  | 'VICTORY_STATE'
  | 'ELO_UPDATE'
  | 'SUDDEN_DEATH'
  | 'FORFEIT';

export interface WalEntry {
  index: number;
  term: number;
  battleId: string;
  command: WalCommand;
  payload: Record<string, unknown>;
  timestamp: number;
  committed: boolean;
}

@Injectable()
export class WalLogService {
  private readonly logger = new Logger(WalLogService.name);
  private readonly inMemoryWal = new Map<string, WalEntry[]>();

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  /**
   * Appends an uncommitted log entry to the write-ahead log.
   */
  public async append(
    battleId: string,
    term: number,
    command: WalCommand,
    payload: Record<string, unknown>,
  ): Promise<WalEntry> {
    const entries = this.inMemoryWal.get(battleId) || [];
    const index = entries.length + 1;

    const entry: WalEntry = {
      index,
      term,
      battleId,
      command,
      payload,
      timestamp: Date.now(),
      committed: false,
    };

    entries.push(entry);
    this.inMemoryWal.set(battleId, entries);

    // Asynchronously replicate to Redis WAL stream / cache if available
    try {
      if (this.redis) {
        const streamKey = `battle:wal:${battleId}`;
        await this.redis.getClient()?.xadd(
          streamKey,
          '*',
          'index',
          String(index),
          'term',
          String(term),
          'command',
          command,
          'payload',
          JSON.stringify(payload),
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.debug(`Redis WAL stream write skipped: ${msg}`);
    }

    return entry;
  }

  /**
   * Commits an entry at index once quorum consensus is reached.
   */
  public async commit(battleId: string, index: number): Promise<WalEntry | null> {
    const entries = this.inMemoryWal.get(battleId);
    if (!entries) return null;

    const target = entries.find((e) => e.index === index);
    if (!target) return null;

    target.committed = true;

    // Persist committed authoritative entry to Postgres if available
    try {
      const prismaAny = this.prisma as unknown as {
        battleWalEntry?: {
          upsert: (args: unknown) => Promise<unknown>;
        };
      };
      if (prismaAny?.battleWalEntry) {
        await prismaAny.battleWalEntry.upsert({
          where: { battleId_index: { battleId, index } },
          create: {
            battleId,
            term: target.term,
            index: target.index,
            command: target.command,
            payload: target.payload,
            applied: true,
          },
          update: {
            applied: true,
          },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.debug(`Prisma WAL commit skipped: ${msg}`);
    }

    return target;
  }

  /**
   * Retrieves log entries starting from startIndex for followers.
   */
  public getEntriesSince(battleId: string, startIndex: number): WalEntry[] {
    const entries = this.inMemoryWal.get(battleId) || [];
    return entries.filter((e) => e.index >= startIndex);
  }

  /**
   * Returns the last entry in the log or null if empty.
   */
  public getLastEntry(battleId: string): WalEntry | null {
    const entries = this.inMemoryWal.get(battleId) || [];
    return entries.length > 0 ? entries[entries.length - 1] : null;
  }

  /**
   * Truncates uncommitted conflicting log entries after index (Raft conflict resolution).
   */
  public truncateAfter(battleId: string, index: number): void {
    const entries = this.inMemoryWal.get(battleId);
    if (!entries) return;

    const valid = entries.filter((e) => e.index <= index);
    this.inMemoryWal.set(battleId, valid);
  }

  /**
   * Replays all committed entries from index 1 to reconstitute battle state machine.
   */
  public replay(battleId: string): WalEntry[] {
    const entries = this.inMemoryWal.get(battleId) || [];
    return entries.filter((e) => e.committed).sort((a, b) => a.index - b.index);
  }

  /**
   * Clears in-memory log (for testing / session end).
   */
  public clear(battleId?: string): void {
    if (battleId) {
      this.inMemoryWal.delete(battleId);
    } else {
      this.inMemoryWal.clear();
    }
  }
}
