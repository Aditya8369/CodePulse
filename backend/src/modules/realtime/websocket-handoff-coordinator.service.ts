export interface ConnectionStateSnapshot {
  connectionId: string;
  userId: string;
  lastMessageSeq: number;
}

export class WebSocketHandoffCoordinatorService {
  private snapshots = new Map<string, ConnectionStateSnapshot>();

  public captureState(snapshot: ConnectionStateSnapshot): void {
    this.snapshots.set(snapshot.connectionId, snapshot);
  }

  public restoreState(connectionId: string): ConnectionStateSnapshot | null {
    const found = this.snapshots.get(connectionId);
    if (found) {
      this.snapshots.delete(connectionId);
      return found;
    }
    return null;
  }
}
