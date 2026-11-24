export class HighCardinalityIndexingService {
  private labelIndex = new Map<string, Set<number>>();

  public indexSeries(seriesId: number, labels: Record<string, string>): void {
    for (const [key, val] of Object.entries(labels)) {
      const token = `${key}=${val}`;
      if (!this.labelIndex.has(token)) {
        this.labelIndex.set(token, new Set<number>());
      }
      this.labelIndex.get(token)!.add(seriesId);
    }
  }

  public query(labels: Record<string, string>): number[] {
    const entries = Object.entries(labels);
    if (entries.length === 0) return [];

    let currentSet: Set<number> | null = null;
    for (const [key, val] of entries) {
      const token = `${key}=${val}`;
      const matching = this.labelIndex.get(token) || new Set<number>();
      if (!currentSet) {
        currentSet = new Set(matching);
      } else {
        // Set intersection
        currentSet = new Set([...currentSet].filter(id => matching.has(id)));
      }
    }

    return currentSet ? Array.from(currentSet) : [];
  }
}
