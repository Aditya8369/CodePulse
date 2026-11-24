export interface RUMBeacon {
  sessionId: string;
  metric: string;
  value: number;
}

export class RUMBeaconIngestionBufferService {
  private buffer: RUMBeacon[] = [];
  private batchSize: number = 100;

  public push(beacon: RUMBeacon): RUMBeacon[] | null {
    this.buffer.push(beacon);
    if (this.buffer.length >= this.batchSize) {
      const batch = [...this.buffer];
      this.buffer = [];
      return batch;
    }
    return null;
  }

  public flush(): RUMBeacon[] {
    const batch = [...this.buffer];
    this.buffer = [];
    return batch;
  }
}
