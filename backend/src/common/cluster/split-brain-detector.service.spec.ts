import { ServiceUnavailableException } from '@nestjs/common';
import { QuorumWitnessService } from './quorum-witness.service';
import { SplitBrainDetectorService } from './split-brain-detector.service';
import { NodeFenceState } from './cluster.types';

describe('SplitBrainDetectorService', () => {
  let detector: SplitBrainDetectorService;
  let witness: QuorumWitnessService;

  beforeEach(() => {
    witness = new QuorumWitnessService(undefined, { totalExpectedNodes: 3 });
    detector = new SplitBrainDetectorService(witness, {
      localNodeId: 'node-1',
      localZone: 'us-east-1a',
      heartbeatTimeoutMs: 500,
      maxConsecutiveMisses: 2,
      totalExpectedNodes: 3,
      autoFenceEnabled: true,
      quorumStrategy: 'MAJORITY_COUNT',
    });
  });

  afterEach(() => {
    detector.onModuleDestroy();
    witness.onModuleDestroy();
  });

  it('should initialize local node in topology and report initial partitioned status if peers missing', () => {
    expect(detector.getLocalNodeId()).toBe('node-1');
    expect(detector.getLocalZone()).toBe('us-east-1a');

    const status = detector.evaluateQuorumAndFence();
    expect(status.hasQuorum).toBe(false); // Only 1 node out of 3, quorum is 2
    expect(status.fenceState).toBe('FENCED_READ_ONLY');
  });

  it('should achieve quorum and ACTIVE state when majority of heartbeats arrive', () => {
    detector.registerNode('node-2', 'us-east-1b');
    detector.recordHeartbeat({
      nodeId: 'node-2',
      zone: 'us-east-1b',
      term: 1,
      timestamp: Date.now(),
      activePeers: ['node-1', 'node-2'],
    });

    const status = detector.evaluateQuorumAndFence();
    expect(status.hasQuorum).toBe(true);
    expect(status.reachableNodeCount).toBe(2);
    expect(status.fenceState).toBe('ACTIVE');
    expect(() => detector.assertWritePermitted()).not.toThrow();
  });

  it('should trigger FENCED_READ_ONLY and reject write operations when partition drops below quorum', () => {
    detector.registerNode('node-2', 'us-east-1b');
    detector.recordHeartbeat({
      nodeId: 'node-2',
      zone: 'us-east-1b',
      term: 1,
      timestamp: Date.now(),
      activePeers: ['node-1', 'node-2'],
    });

    expect(detector.getFenceState()).toBe('ACTIVE');

    // Simulate network partition disconnecting node-2
    detector.simulatePartition(['node-2']);

    const status = detector.evaluateQuorumAndFence();
    expect(status.hasQuorum).toBe(false);
    expect(status.fenceState).toBe('FENCED_READ_ONLY');
    expect(() => detector.assertWritePermitted()).toThrow(ServiceUnavailableException);
  });

  it('should notify registered fence listeners on state transitions', () => {
    const transitions: NodeFenceState[] = [];
    const unsubscribe = detector.registerFenceListener((state) => {
      transitions.push(state);
    });

    detector.registerNode('node-2', 'us-east-1b');
    detector.recordHeartbeat({
      nodeId: 'node-2',
      zone: 'us-east-1b',
      term: 1,
      timestamp: Date.now(),
      activePeers: ['node-1', 'node-2'],
    });

    expect(transitions).toContain('ACTIVE');

    detector.simulatePartition(['node-2']);
    expect(transitions).toContain('FENCED_READ_ONLY');

    unsubscribe();
  });

  it('should automatically recover and restore ACTIVE mode when partition heals', () => {
    detector.registerNode('node-2', 'us-east-1b');
    detector.recordHeartbeat({
      nodeId: 'node-2',
      zone: 'us-east-1b',
      term: 1,
      timestamp: Date.now(),
      activePeers: ['node-1', 'node-2'],
    });

    detector.simulatePartition(['node-2']);
    expect(detector.getFenceState()).toBe('FENCED_READ_ONLY');

    // Heal partition
    detector.healPartition();
    expect(detector.getFenceState()).toBe('ACTIVE');
    expect(() => detector.assertWritePermitted()).not.toThrow();
  });

  it('should support weighted quorum calculation', () => {
    const weightedDetector = new SplitBrainDetectorService(witness, {
      localNodeId: 'primary-node',
      localZone: 'us-east-1a',
      quorumStrategy: 'WEIGHTED_QUORUM',
      totalExpectedNodes: 3,
    });

    // Primary has weight 3, secondary nodes have weight 1 each (total = 5)
    weightedDetector.registerNode('primary-node', 'us-east-1a', 3);
    weightedDetector.registerNode('worker-1', 'us-east-1b', 1);
    weightedDetector.registerNode('worker-2', 'us-east-1c', 1);

    // Primary alone has 3/5 > 50% weight -> quorum achieved!
    const status = weightedDetector.evaluateQuorumAndFence();
    expect(status.hasQuorum).toBe(true);
    expect(status.fenceState).toBe('ACTIVE');

    weightedDetector.onModuleDestroy();
  });

  it('should execute partition detection in sub-500ms', () => {
    for (let i = 2; i <= 10; i++) {
      detector.registerNode(`node-${i}`, `us-east-1${String.fromCharCode(97 + (i % 3))}`);
    }

    const start = Date.now();
    const status = detector.evaluateQuorumAndFence();
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(50); // Well under 500ms benchmark
    expect(status.lastPartitionEvaluatedAt).toBeGreaterThan(0);
  });

  it('should track comprehensive cluster metrics', () => {
    detector.registerNode('node-2', 'us-east-1b');
    detector.recordHeartbeat({
      nodeId: 'node-2',
      zone: 'us-east-1b',
      term: 1,
      timestamp: Date.now(),
      activePeers: ['node-1', 'node-2'],
    });

    detector.simulatePartition(['node-2']);
    detector.healPartition();

    const metrics = detector.getMetrics();
    expect(metrics.totalEvaluations).toBeGreaterThan(0);
    expect(metrics.totalPartitionDetections).toBeGreaterThanOrEqual(1);
    expect(metrics.totalQuorumRecoveries).toBeGreaterThanOrEqual(1);
  });
});
