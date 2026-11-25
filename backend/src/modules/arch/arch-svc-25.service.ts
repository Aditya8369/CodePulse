/**
 * Architecture Service 25: Streaming Event Deduplication Engine
 * Subsystem: Tiered Sliding Bloom Filters
 */

export class SlidingBloomFilterService {
  private activeFilter: Set<string> = new Set();
  private previousFilter: Set<string> = new Set();
  private currentCount = 0;

  private readonly maxItemsPerTier: number;
  constructor(maxItemsPerTier = 1000) {
    this.maxItemsPerTier = maxItemsPerTier;
  }

  public isDuplicateOrAdd(eventId: string): boolean {
    if (this.activeFilter.has(eventId) || this.previousFilter.has(eventId)) {
      return true; // Duplicate detected
    }

    if (this.currentCount >= this.maxItemsPerTier) {
      // Slide tiers
      this.previousFilter = this.activeFilter;
      this.activeFilter = new Set();
      this.currentCount = 0;
    }

    this.activeFilter.add(eventId);
    this.currentCount++;
    return false;
  }

  public get counts(): { active: number; previous: number } {
    return {
      active: this.activeFilter.size,
      previous: this.previousFilter.size,
    };
  }
}
