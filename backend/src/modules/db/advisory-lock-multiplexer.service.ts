export class AdvisoryLockMultiplexerService {
  private heldLocks = new Set<string>();

  public hashKey(namespace: string, resourceId: string): string {
    const combined = `${namespace}:${resourceId}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = (hash << 5) - hash + combined.charCodeAt(i);
      hash |= 0;
    }
    return String(Math.abs(hash));
  }

  public tryAcquire(namespace: string, resourceId: string): boolean {
    const lockId = this.hashKey(namespace, resourceId);
    if (this.heldLocks.has(lockId)) return false;
    this.heldLocks.add(lockId);
    return true;
  }

  public release(namespace: string, resourceId: string): void {
    const lockId = this.hashKey(namespace, resourceId);
    this.heldLocks.delete(lockId);
  }
}
