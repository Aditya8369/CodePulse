import { Injectable } from '@nestjs/common';

export interface CrdtRow {
  rowId: string;
  values: Record<string, any>;
  version: number;
  updatedAt: number;
}

@Injectable()
export class CrdtDatabaseTableResolverService {
  public resolveConflict(localRow: CrdtRow, incomingRow: CrdtRow): CrdtRow {
    // Last-Write-Wins (LWW) resolver with version tie-breaker
    if (incomingRow.version > localRow.version) {
      return incomingRow;
    }

    if (incomingRow.version === localRow.version) {
      return incomingRow.updatedAt >= localRow.updatedAt ? incomingRow : localRow;
    }

    return localRow;
  }
}
