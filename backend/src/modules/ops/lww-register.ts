/**
 * Last-Write-Wins (LWW) CRDT Register
 * Provides conflict-free convergent replication across AWS and GCP nodes.
 */

export interface LwwState<T> {
  value: T;
  timestamp: number;
  authorId: string;
  sequence: number;
}

export class LwwRegister<T> {
  private value: T;
  private timestamp: number;
  private authorId: string;
  private sequence: number;

  constructor(initialValue: T, authorId: string, timestamp?: number, sequence?: number) {
    this.value = initialValue;
    this.authorId = authorId;
    this.timestamp = timestamp ?? Date.now();
    this.sequence = sequence ?? 0;
  }

  public getValue(): T {
    return this.value;
  }

  public getState(): LwwState<T> {
    return {
      value: this.value,
      timestamp: this.timestamp,
      authorId: this.authorId,
      sequence: this.sequence,
    };
  }

  /**
   * Sets value locally, advancing timestamp and monotonic sequence.
   */
  public set(value: T, timestampMs?: number): LwwState<T> {
    const now = timestampMs ?? Date.now();
    this.timestamp = Math.max(now, this.timestamp + 1);
    this.sequence++;
    this.value = value;
    return this.getState();
  }

  /**
   * Merges remote LWW register state with deterministic tie-breaking:
   * 1. Higher physical timestamp wins
   * 2. Higher sequence number wins
   * 3. Deterministic author ID string comparison wins
   */
  public merge(remote: LwwState<T>): boolean {
    if (remote.timestamp > this.timestamp) {
      this.applyRemote(remote);
      return true;
    }

    if (remote.timestamp === this.timestamp) {
      if (remote.sequence > this.sequence) {
        this.applyRemote(remote);
        return true;
      }
      if (remote.sequence === this.sequence && remote.authorId.localeCompare(this.authorId) > 0) {
        this.applyRemote(remote);
        return true;
      }
    }

    return false; // Local state won
  }

  private applyRemote(remote: LwwState<T>): void {
    this.value = remote.value;
    this.timestamp = remote.timestamp;
    this.authorId = remote.authorId;
    this.sequence = remote.sequence;
  }
}
