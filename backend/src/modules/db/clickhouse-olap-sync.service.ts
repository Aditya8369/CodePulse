export class ClickHouseOLAPSyncService {
  private batch: any[] = [];
  private batchSize: number;

  constructor(batchSize: number = 100) {
    this.batchSize = batchSize;
  }

  public enqueueRecord(record: any): boolean {
    this.batch.push(record);
    return this.batch.length >= this.batchSize;
  }

  public flush(): any[] {
    const out = [...this.batch];
    this.batch = [];
    return out;
  }
}
