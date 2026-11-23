import { describe, it, expect, beforeEach } from 'vitest';
import { ConsistentHashRingService } from './consistent-hash-ring.service';

describe('ConsistentHashRingService (Ketama 256 Virtual Nodes #1284)', () => {
  let ringService: ConsistentHashRingService;

  beforeEach(() => {
    ringService = new ConsistentHashRingService(256);
  });

  it('populates 256 virtual nodes per physical shard node', () => {
    ringService.addNode('shard-us-east-1');
    expect(ringService.getVirtualNodeCount()).toBe(256);

    ringService.addNode('shard-eu-west-1');
    expect(ringService.getVirtualNodeCount()).toBe(512);

    ringService.addNode('shard-ap-south-1');
    expect(ringService.getVirtualNodeCount()).toBe(768);
  });

  it('consistently routes the same key to the same physical node', () => {
    ringService.addNode('shard-A');
    ringService.addNode('shard-B');
    ringService.addNode('shard-C');

    const node1 = ringService.getNode('user-challenger-45');
    const node2 = ringService.getNode('user-challenger-45');
    expect(node1).toBe(node2);
  });

  it('maintains standard deviation of player distribution < 5% across shards with 256 vnodes', () => {
    const shards = ['shard-0', 'shard-1', 'shard-2', 'shard-3', 'shard-4'];
    shards.forEach((s) => ringService.addNode(s));

    // Generate 10,000 matchmaking ticket keys
    const testKeys: string[] = [];
    for (let i = 0; i < 10000; i++) {
      testKeys.push(`ticket-${i}-elo-${1200 + (i % 800)}`);
    }

    const stats = ringService.evaluateDistribution(testKeys);
    expect(stats.nodeCount).toBe(5);
    expect(stats.totalVirtualNodes).toBe(5 * 256);

    // Standard deviation of distribution must be < 5% across shards
    expect(stats.distributionStdDevPercent).toBeLessThan(5);
  });

  it('minimizes key reassignment when adding a new shard during autoscaling', () => {
    const initialShards = ['shard-0', 'shard-1', 'shard-2', 'shard-3'];
    initialShards.forEach((s) => ringService.addNode(s));

    const testKeys: string[] = [];
    for (let i = 0; i < 1000; i++) {
      testKeys.push(`player-session-${i}`);
    }

    const initialAssignments = new Map<string, string>();
    for (const key of testKeys) {
      initialAssignments.set(key, ringService.getNode(key));
    }

    // Add 5th shard (horizontal autoscaling)
    ringService.addNode('shard-4');

    let reassignedCount = 0;
    for (const key of testKeys) {
      const newNode = ringService.getNode(key);
      if (newNode !== initialAssignments.get(key)) {
        reassignedCount++;
        // Reassigned keys must ONLY move to the new shard-4
        expect(newNode).toBe('shard-4');
      }
    }

    // In a 4-to-5 node expansion, ideal reassignment is ~20% (1/5)
    const reassignmentRate = (reassignedCount / testKeys.length) * 100;
    expect(reassignmentRate).toBeGreaterThan(15);
    expect(reassignmentRate).toBeLessThan(25);
  });

  it('throws error when routing on an empty ring', () => {
    expect(() => ringService.getNode('user-1')).toThrow('Consistent hash ring is empty');
  });

  it('correctly handles node removal and ring cleanup', () => {
    ringService.addNode('node-1');
    ringService.addNode('node-2');
    expect(ringService.getVirtualNodeCount()).toBe(512);

    ringService.removeNode('node-1');
    expect(ringService.getVirtualNodeCount()).toBe(256);
    expect(ringService.getNode('arbitrary-key')).toBe('node-2');
  });
});
