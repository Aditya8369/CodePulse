import { describe, it, expect, beforeEach } from 'vitest';
import { VectorClockService } from './vector-clock.service';
import { VectorClock } from './vector-clock.types';

describe('VectorClockService (Multi-Region Causality & 3-Way Reconciler #1285)', () => {
  let service: VectorClockService;

  beforeEach(() => {
    service = new VectorClockService();
  });

  describe('Vector Clock Progression & Merging', () => {
    it('initializes empty clock and increments component on tick', () => {
      const docId = 'doc-101';
      expect(service.getClock(docId)).toEqual({});

      const clock1 = service.tick(docId, 'node-us-east');
      expect(clock1).toEqual({ 'node-us-east': 1 });

      const clock2 = service.tick(docId, 'node-us-east');
      expect(clock2).toEqual({ 'node-us-east': 2 });

      const clock3 = service.tick(docId, 'node-eu-west');
      expect(clock3).toEqual({ 'node-us-east': 2, 'node-eu-west': 1 });
    });

    it('merges remote vector clocks taking element-wise supremum', () => {
      const docId = 'doc-battle-42';
      service.tick(docId, 'node-A'); // A: 1
      service.tick(docId, 'node-A'); // A: 2
      service.tick(docId, 'node-B'); // B: 1

      const remoteClock: VectorClock = {
        'node-A': 1,
        'node-B': 3,
        'node-C': 5,
      };

      const merged = service.merge(docId, remoteClock);
      expect(merged).toEqual({
        'node-A': 2, // max(2, 1)
        'node-B': 3, // max(1, 3)
        'node-C': 5, // max(0, 5)
      });
    });
  });

  describe('Causality Comparison & Concurrency Detection', () => {
    it('correctly establishes BEFORE and AFTER relationships', () => {
      const clockA: VectorClock = { 'node-1': 1, 'node-2': 1 };
      const clockB: VectorClock = { 'node-1': 2, 'node-2': 1 };

      expect(VectorClockService.compare(clockA, clockB)).toBe('BEFORE');
      expect(VectorClockService.compare(clockB, clockA)).toBe('AFTER');
    });

    it('identifies EQUAL clocks', () => {
      const clockA: VectorClock = { 'node-1': 3, 'node-2': 4 };
      const clockB: VectorClock = { 'node-1': 3, 'node-2': 4 };

      expect(VectorClockService.compare(clockA, clockB)).toBe('EQUAL');
    });

    it('detects CONCURRENT edits (divergence in multi-region replicas)', () => {
      // Node 1 made an edit while Node 2 concurrently made an edit without seeing Node 1's change
      const clockTokyo: VectorClock = { 'tokyo': 2, 'london': 1 };
      const clockLondon: VectorClock = { 'tokyo': 1, 'london': 2 };

      expect(VectorClockService.compare(clockTokyo, clockLondon)).toBe('CONCURRENT');
      expect(service.isConcurrent(clockTokyo, clockLondon)).toBe(true);

      const distance = VectorClockService.divergenceDistance(clockTokyo, clockLondon);
      expect(distance).toBe(2); // |2-1| + |1-2| = 2 edits diverged
    });

    it('computes joined vector clock correctly', () => {
      const clockA: VectorClock = { 'a': 3, 'b': 2, 'c': 1 };
      const clockB: VectorClock = { 'a': 1, 'b': 4, 'd': 5 };

      const joined = VectorClockService.join(clockA, clockB);
      expect(joined).toEqual({
        a: 3,
        b: 4,
        c: 1,
        d: 5,
      });
    });
  });

  describe('Three-Way AST / Text Reconciliation', () => {
    it('cleanly merges when only one side modified the base', () => {
      const base = 'function add(a, b) {\n  return a + b;\n}';
      const local = 'function add(a, b) {\n  // Add two numbers\n  return a + b;\n}';
      const remote = base; // remote made no changes

      const res = service.reconcileThreeWay(
        base,
        local,
        remote,
        { 'node-1': 1 },
        { 'node-1': 2 },
        { 'node-1': 1 }
      );

      expect(res.hasConflict).toBe(false);
      expect(res.mergedText).toBe(local);
    });

    it('resolves conflicting concurrent line edits without dropping code', () => {
      const base = 'const x = 10;';
      const local = 'const x = 20; // local edit';
      const remote = 'const x = 30; // remote edit';

      const res = service.reconcileThreeWay(
        base,
        local,
        remote,
        { 'node-1': 1, 'node-2': 1 },
        { 'node-1': 2, 'node-2': 1 },
        { 'node-1': 1, 'node-2': 2 },
        'AST_THREE_WAY'
      );

      expect(res.hasConflict).toBe(true);
      expect(res.conflictingRegions.length).toBe(1);
      // Both additions are preserved in deterministic order
      expect(res.mergedText).toContain('const x = 20;');
      expect(res.mergedText).toContain('const x = 30;');
      expect(res.resolvedClock).toEqual({ 'node-1': 2, 'node-2': 2 });
    });
  });

  describe('Multi-Replica Matrix & Causality Report', () => {
    it('builds an NxN causality matrix for global replicas', () => {
      const replicas = {
        'virginia': { virginia: 5, frankfurt: 3, singapore: 2 },
        'frankfurt': { virginia: 4, frankfurt: 4, singapore: 2 },
        'singapore': { virginia: 3, frankfurt: 3, singapore: 6 },
      };

      const report = service.generateCausalityReport('doc-global-arena', replicas);
      expect(report.replicas.length).toBe(3);
      expect(report.divergenceDetected).toBe(true);
      expect(report.matrix['virginia']['frankfurt']).toBe('CONCURRENT');
      expect(report.maxDivergenceDelta).toBeGreaterThan(0);
    });
  });

  describe('Garbage Collection & Compaction of Inactive Replicas', () => {
    it('prunes replicas that have been inactive past TTL', () => {
      const docId = 'doc-gc-test';
      service.tick(docId, 'active-node');
      service.tick(docId, 'stale-node');

      // Compact with ttl=0 to simulate immediate expiration of stale node
      const pruned = service.compactInactiveReplicas(docId, 0);
      expect(pruned).toBeGreaterThan(0);
    });
  });
});
