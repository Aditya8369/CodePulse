export interface MirrorRecord {
  id: string;
  topic: string;
  payload: any;
  headers: {
    originDc: string;
    visitedDcs: string[]; // loop prevention provenance tag
    hopCount: number;
    timestamp: number;
  };
}

export class CrossDcMirrorService {
  constructor(
    private readonly localDc: string,
    private readonly maxHops = 3
  ) {}

  public processIncomingRecord(record: MirrorRecord): { shouldMirror: boolean; reason?: string; mirroredRecord?: MirrorRecord } {
    // 1. Loop avoidance: check if this DC has already seen the record
    if (record.headers.visitedDcs.includes(this.localDc)) {
      return { shouldMirror: false, reason: `Circular replication loop detected for DC: ${this.localDc}` };
    }

    // 2. Hop count threshold
    if (record.headers.hopCount >= this.maxHops) {
      return { shouldMirror: false, reason: 'Max hop count exceeded' };
    }

    // 3. Clone and enrich headers for next hop
    const updatedRecord: MirrorRecord = {
      ...record,
      headers: {
        ...record.headers,
        visitedDcs: [...record.headers.visitedDcs, this.localDc],
        hopCount: record.headers.hopCount + 1
      }
    };

    return {
      shouldMirror: true,
      mirroredRecord: updatedRecord
    };
  }

  public createOutboundRecord(id: string, topic: string, payload: any): MirrorRecord {
    return {
      id,
      topic,
      payload,
      headers: {
        originDc: this.localDc,
        visitedDcs: [this.localDc],
        hopCount: 0,
        timestamp: Date.now()
      }
    };
  }
}
