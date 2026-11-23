import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { BiTemporalRecord, TimeTravelQueryOptions } from './bitemporal.types';

@Injectable()
export class BiTemporalService implements OnModuleDestroy {
  private readonly logger = new Logger(BiTemporalService.name);

  private readonly records = new Map<string, BiTemporalRecord[]>();

  public onModuleDestroy(): void {
    this.records.clear();
  }

  /**
   * Inserts or updates an entity with bi-temporal dimensions (valid time + system time).
   */
  public recordVersion<T>(entityId: string, data: T, validFrom: number, validTo = Infinity): BiTemporalRecord<T> {
    const now = Date.now();
    const list = this.records.get(entityId) ?? [];

    // Close previous system time record if any
    for (const prev of list) {
      if (prev.systemTo === Infinity && prev.validFrom <= validFrom) {
        prev.systemTo = now;
      }
    }

    const rec: BiTemporalRecord<T> = {
      entityId,
      data,
      validFrom,
      validTo,
      systemFrom: now,
      systemTo: Infinity,
    };

    list.push(rec as BiTemporalRecord);
    this.records.set(entityId, list);
    return rec;
  }

  /**
   * Executes time-travel query reconstructing state AS OF past valid time and past system time.
   */
  public queryAsOf<T>(options: TimeTravelQueryOptions): T | null {
    const list = (this.records.get(options.entityId) ?? []) as BiTemporalRecord<T>[];
    const validTarget = options.asOfValidTime ?? Date.now();
    const systemTarget = options.asOfSystemTime ?? Date.now();

    for (let i = list.length - 1; i >= 0; i--) {
      const rec = list[i];
      const validMatch = rec.validFrom <= validTarget && validTarget < rec.validTo;
      const systemMatch = rec.systemFrom <= systemTarget && systemTarget < rec.systemTo;

      if (validMatch && systemMatch) {
        return rec.data;
      }
    }

    return null;
  }
}
