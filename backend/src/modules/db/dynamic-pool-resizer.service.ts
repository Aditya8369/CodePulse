export class DynamicPoolResizerService {
  private minPool: number;
  private maxPool: number;

  constructor(minPool: number = 5, maxPool: number = 50) {
    this.minPool = minPool;
    this.maxPool = maxPool;
  }

  public calculateTargetSize(activeQueries: number, queryQueueDepth: number): number {
    const demand = activeQueries + queryQueueDepth;
    const recommended = Math.ceil(demand * 1.2);
    return Math.min(this.maxPool, Math.max(this.minPool, recommended));
  }
}
