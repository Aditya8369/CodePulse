import { Injectable, Logger } from '@nestjs/common';

export interface CrdtEntry {
  key: string;
  value: any;
  timestamp: number;
  nodeId: string;
}

@Injectable()
export class CrdtDocumentSynchronizerService {
  private readonly logger = new Logger(CrdtDocumentSynchronizerService.name);
  private state = new Map<string, CrdtEntry>(); // LWW-Element-Set per key

  public setLocal(key: string, value: any, nodeId: string): CrdtEntry {
    const entry: CrdtEntry = { key, value, timestamp: Date.now(), nodeId };
    this.state.set(key, entry);
    return entry;
  }

  public mergeRemoteEntry(remote: CrdtEntry): boolean {
    const local = this.state.get(remote.key);
    // Last-Write-Wins (LWW) with deterministic node ID tie-breaking
    if (!local || remote.timestamp > local.timestamp || (remote.timestamp === local.timestamp && remote.nodeId > local.nodeId)) {
      this.state.set(remote.key, remote);
      return true;
    }
    return false;
  }

  public getValue(key: string): any {
    return this.state.get(key)?.value;
  }
}
