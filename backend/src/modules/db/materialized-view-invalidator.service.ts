export class MaterializedViewInvalidatorService {
  private dirtyViews = new Set<string>();
  private debounceMs: number;
  private lastMarkedTime = new Map<string, number>();

  constructor(debounceMs: number = 5000) {
    this.debounceMs = debounceMs;
  }

  public markDirty(viewName: string, nowMs: number = Date.now()): void {
    this.dirtyViews.add(viewName);
    this.lastMarkedTime.set(viewName, nowMs);
  }

  public getViewsReadyToRefresh(nowMs: number = Date.now()): string[] {
    const ready: string[] = [];
    for (const view of this.dirtyViews) {
      const last = this.lastMarkedTime.get(view) || 0;
      if (nowMs - last >= this.debounceMs) {
        ready.push(view);
      }
    }
    return ready;
  }

  public clearRefreshed(viewName: string): void {
    this.dirtyViews.delete(viewName);
    this.lastMarkedTime.delete(viewName);
  }
}
