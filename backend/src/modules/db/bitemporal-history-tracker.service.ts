export interface BiTemporalRecord {
  entityId: string;
  validTimeStartMs: number;
  validTimeEndMs: number;
  txTimeStartMs: number;
  data: any;
}

export class BiTemporalHistoryTrackerService {
  private records: BiTemporalRecord[] = [];

  public insert(entityId: string, validStart: number, validEnd: number, data: any, txTime: number = Date.now()): BiTemporalRecord {
    const r: BiTemporalRecord = {
      entityId,
      validTimeStartMs: validStart,
      validTimeEndMs: validEnd,
      txTimeStartMs: txTime,
      data
    };
    this.records.push(r);
    return r;
  }

  public queryAsOf(entityId: string, asOfValidTime: number): BiTemporalRecord | undefined {
    return this.records.find(
      r => r.entityId === entityId && asOfValidTime >= r.validTimeStartMs && asOfValidTime <= r.validTimeEndMs
    );
  }
}
