import {
  VirtualScrollEngine,
  CompetitorEntry,
} from './virtual-scroll-engine';

describe('VirtualScrollEngine (100,000+ Competitor Ladder)', () => {
  let engine: VirtualScrollEngine;

  beforeEach(() => {
    engine = new VirtualScrollEngine(48, 5); // 48px row, 5 buffer rows
  });

  describe('Window Slice Calculations Across 100,000 Items', () => {
    it('computes exact virtual window for 100,000 rows in O(1) time', () => {
      engine.setViewport(600, 100000);

      const win = engine.computeWindow();
      expect(win.totalContentHeight).toBe(4800000); // 100,000 * 48px
      expect(win.startIndex).toBe(0);
      expect(win.visibleCount).toBe(13); // ceil(600 / 48)
      expect(win.endIndex).toBe(18); // 13 + 5 buffer
    });

    it('shifts slice boundaries correctly when scrolled down to row 50,000', () => {
      engine.setViewport(600, 100000);
      const scrollY = 50000 * 48; // 2,400,000px
      engine.setScrollY(scrollY);

      const win = engine.computeWindow();
      expect(win.startIndex).toBe(50000 - 5);
      expect(win.endIndex).toBe(50000 + 13 + 5);
    });

    it('clamps scrolling to valid range [0, maxScrollY]', () => {
      engine.setViewport(600, 1000);
      engine.setScrollY(-500);
      expect(engine.getScrollY()).toBe(0);

      engine.setScrollY(1000000);
      expect(engine.getScrollY()).toBe(1000 * 48 - 600);
    });
  });

  describe('Hit-Testing & Search Indexing', () => {
    it('hit-tests mouse coordinates to correct row index in O(1)', () => {
      engine.setViewport(600, 100000);
      engine.setScrollY(0);

      const index0 = engine.hitTest(20);
      expect(index0).toBe(0);

      const index5 = engine.hitTest(48 * 5 + 10);
      expect(index5).toBe(5);
    });

    it('binary searches 100,000 competitors by ELO in under 1ms', () => {
      // 100,000 items sorted in descending ELO
      const competitors: CompetitorEntry[] = Array.from({ length: 100000 }, (_, i) => ({
        rank: i + 1,
        userId: `user-${i + 1}`,
        username: `Coder_${i + 1}`,
        elo: Math.max(800, 2600 - Math.floor(i * 0.018)),
        tier: 'GOLD',
        winRatePct: 60,
        streak: 3,
        matchesPlayed: 100,
        countryCode: 'US',
      }));

      const startTime = performance.now();
      const matchIndex = engine.binarySearchByElo(competitors, 2100);
      const searchDurationMs = performance.now() - startTime;

      expect(searchDurationMs).toBeLessThan(1);
      expect(matchIndex).toBeGreaterThan(0);
      expect(Math.abs(competitors[matchIndex].elo - 2100)).toBeLessThanOrEqual(5);
    });

    it('filters competitors by username prefix', () => {
      const items: CompetitorEntry[] = [
        { rank: 1, userId: '1', username: 'AlphaCoder', elo: 2400, tier: 'GRANDMASTER', winRatePct: 75, streak: 5, matchesPlayed: 200, countryCode: 'US' },
        { rank: 2, userId: '2', username: 'BetaKnight', elo: 2300, tier: 'DIAMOND', winRatePct: 70, streak: 2, matchesPlayed: 180, countryCode: 'DE' },
        { rank: 3, userId: '3', username: 'AlphaWolf', elo: 2200, tier: 'DIAMOND', winRatePct: 65, streak: 1, matchesPlayed: 150, countryCode: 'IN' },
      ];

      const results = engine.filterByPrefix(items, 'alpha');
      expect(results).toHaveLength(2);
      expect(results[0].username).toBe('AlphaCoder');
      expect(results[1].username).toBe('AlphaWolf');
    });
  });

  describe('Inertial Scrolling Physics', () => {
    it('decays velocity over time with friction', () => {
      engine.setViewport(600, 1000);
      engine.applyVelocity(50);

      const moving1 = engine.tickPhysics();
      expect(moving1).toBe(true);
      expect(engine.getScrollY()).toBeGreaterThan(0);

      // Advance physics until rest
      for (let i = 0; i < 50; i++) {
        engine.tickPhysics();
      }
      const movingEnd = engine.tickPhysics();
      expect(movingEnd).toBe(false);
    });
  });
});
