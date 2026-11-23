/**
 * CodePulse High-Performance Virtual Scroll Engine
 * Designed for rendering 100,000+ competitors on HTML5 Canvas / WebGL
 * with sub-millisecond binary search indexing and 60 FPS inertial physics.
 */

export type CompetitorTier =
  | 'BRONZE'
  | 'SILVER'
  | 'GOLD'
  | 'PLATINUM'
  | 'DIAMOND'
  | 'GRANDMASTER';

export interface CompetitorEntry {
  rank: number;
  userId: string;
  username: string;
  elo: number;
  tier: CompetitorTier;
  winRatePct: number;
  streak: number;
  matchesPlayed: number;
  countryCode: string;
}

export interface VirtualWindow {
  startIndex: number;
  endIndex: number;
  offsetY: number;
  visibleCount: number;
  totalContentHeight: number;
}

export interface ScrollPhysicsState {
  scrollY: number;
  velocityY: number;
  isDragging: boolean;
  maxScrollY: number;
}

export class VirtualScrollEngine {
  private readonly rowHeight: number;
  private readonly bufferRows: number;
  private totalItems = 0;
  private viewportHeight = 600;
  private scrollY = 0;
  private velocityY = 0;
  private readonly friction = 0.94; // Inertial decay

  constructor(rowHeight = 48, bufferRows = 5) {
    this.rowHeight = rowHeight;
    this.bufferRows = bufferRows;
  }

  setViewport(viewportHeight: number, totalItems: number): void {
    this.viewportHeight = Math.max(100, viewportHeight);
    this.totalItems = Math.max(0, totalItems);
    this.clampScroll();
  }

  getScrollY(): number {
    return this.scrollY;
  }

  setScrollY(y: number): void {
    this.scrollY = y;
    this.clampScroll();
  }

  applyDeltaY(deltaY: number): void {
    this.scrollY += deltaY;
    this.clampScroll();
  }

  applyVelocity(velY: number): void {
    this.velocityY = velY;
  }

  /**
   * Advances inertial physics frame (call per requestAnimationFrame)
   */
  tickPhysics(): boolean {
    if (Math.abs(this.velocityY) > 0.1) {
      this.scrollY += this.velocityY;
      this.velocityY *= this.friction;
      this.clampScroll();
      return true; // still moving
    }
    this.velocityY = 0;
    return false; // at rest
  }

  private clampScroll(): void {
    const maxScroll = Math.max(0, this.totalItems * this.rowHeight - this.viewportHeight);
    this.scrollY = Math.max(0, Math.min(maxScroll, this.scrollY));
  }

  /**
   * Computes visible row indices slice and pixel offsets in O(1) time
   */
  computeWindow(): VirtualWindow {
    const totalContentHeight = this.totalItems * this.rowHeight;
    const rawStart = Math.floor(this.scrollY / this.rowHeight);
    const visibleCount = Math.ceil(this.viewportHeight / this.rowHeight);

    const startIndex = Math.max(0, rawStart - this.bufferRows);
    const endIndex = Math.min(this.totalItems - 1, rawStart + visibleCount + this.bufferRows);
    const offsetY = startIndex * this.rowHeight - this.scrollY;

    return {
      startIndex,
      endIndex,
      offsetY,
      visibleCount,
      totalContentHeight,
    };
  }

  /**
   * Hit tests a canvas click/hover Y coordinate to identify the item index in O(1)
   */
  hitTest(pixelY: number): number | null {
    if (pixelY < 0 || pixelY > this.viewportHeight) return null;
    const itemIndex = Math.floor((this.scrollY + pixelY) / this.rowHeight);
    if (itemIndex >= 0 && itemIndex < this.totalItems) {
      return itemIndex;
    }
    return null;
  }

  /**
   * Binary search query looking up competitor by exact ELO bracket in O(log N)
   */
  binarySearchByElo(sortedByEloDesc: CompetitorEntry[], targetElo: number): number {
    let low = 0;
    let high = sortedByEloDesc.length - 1;
    let bestIndex = 0;
    let minDiff = Infinity;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const diff = Math.abs(sortedByEloDesc[mid].elo - targetElo);

      if (diff < minDiff) {
        minDiff = diff;
        bestIndex = mid;
      }

      if (sortedByEloDesc[mid].elo === targetElo) {
        return mid;
      }

      // Array sorted in descending order (highest ELO first)
      if (sortedByEloDesc[mid].elo < targetElo) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return bestIndex;
  }

  /**
   * Fast prefix search filter across 100,000 items
   */
  filterByPrefix(items: CompetitorEntry[], query: string, limit = 500): CompetitorEntry[] {
    if (!query || query.trim() === '') return items;
    const lower = query.toLowerCase().trim();
    const results: CompetitorEntry[] = [];

    for (let i = 0; i < items.length; i++) {
      if (items[i].username.toLowerCase().includes(lower)) {
        results.push(items[i]);
        if (results.length >= limit) break;
      }
    }

    return results;
  }
}
