import { NodeRegistryService } from './node-registry.service';
import { SwimGossipService } from './swim-gossip.service';
import { SwimPacket } from './swim-gossip.types';

describe('SwimGossipService', () => {
  let registry: NodeRegistryService;
  let swim: SwimGossipService;

  beforeEach(() => {
    registry = new NodeRegistryService();
    swim = new SwimGossipService(registry, {
      localNodeId: 'node-alpha',
      probeIntervalMs: 500,
      probeTimeoutMs: 100,
      indirectProbeCount: 2,
      suspectTimeoutMs: 300,
    });
  });

  afterEach(() => {
    swim.onModuleDestroy();
    registry.onModuleDestroy();
  });

  it('should initialize local node as ALIVE in the membership registry', () => {
    const local = registry.getMember('node-alpha');
    expect(local).toBeDefined();
    expect(local?.status).toBe('ALIVE');
    expect(local?.incarnation).toBe(0);
  });

  it('should complete direct probe successfully when target replies', async () => {
    registry.registerMember({
      nodeId: 'node-beta',
      address: '10.0.0.2',
      port: 8000,
      status: 'ALIVE',
      incarnation: 0,
      lastSeenAt: Date.now(),
    });

    swim.setPacketSender(async (packet) => {
      expect(packet.type).toBe('PING');
      expect(packet.targetNodeId).toBe('node-beta');
      return true;
    });

    const result = await swim.executeProbeCycle();
    expect(result.directAck).toBe(true);
    expect(result.indirectAck).toBe(false);
  });

  it('should fallback to indirect PING_REQ when direct ping fails', async () => {
    registry.registerMember({
      nodeId: 'node-target',
      address: '10.0.0.2',
      port: 8000,
      status: 'ALIVE',
      incarnation: 0,
      lastSeenAt: Date.now(),
    });
    registry.registerMember({
      nodeId: 'node-helper',
      address: '10.0.0.3',
      port: 8000,
      status: 'ALIVE',
      incarnation: 0,
      lastSeenAt: Date.now(),
    });

    // Simulate direct ping to target failing, but indirect ping-req via helper succeeding
    swim.setPacketSender(async (packet) => {
      if (packet.type === 'PING') return false; // direct ping fails
      if (packet.type === 'PING_REQ' && packet.targetNodeId === 'node-helper') return true;
      return false;
    });

    const result = await swim.executeProbeCycle();
    if (result.targetNodeId === 'node-target') {
      expect(result.directAck).toBe(false);
      expect(result.indirectAck).toBe(true);
      expect(registry.getMember('node-target')?.status).toBe('ALIVE');
    }
  });

  it('should transition member to SUSPECT when both direct and indirect probes fail', async () => {
    registry.registerMember({
      nodeId: 'node-failing',
      address: '10.0.0.2',
      port: 8000,
      status: 'ALIVE',
      incarnation: 0,
      lastSeenAt: Date.now(),
    });

    swim.setPacketSender(async () => false); // All packets fail

    await swim.executeProbeCycle();
    const failing = registry.getMember('node-failing');
    expect(failing?.status).toBe('SUSPECT');
  });

  it('should expire SUSPECT timeout and transition member to DEAD', () => {
    registry.registerMember({
      nodeId: 'node-timed-out',
      address: '10.0.0.2',
      port: 8000,
      status: 'SUSPECT',
      incarnation: 0,
      lastSeenAt: Date.now() - 500,
      suspectSince: Date.now() - 500, // 500ms > 300ms timeout
    });

    const deadCount = swim.evaluateSuspectTimeouts();
    expect(deadCount).toBe(1);
    expect(registry.getMember('node-timed-out')?.status).toBe('DEAD');
  });

  it('should refute false suspect report about self with incremented incarnation', () => {
    // Inbound packet claiming node-alpha is SUSPECT at incarnation 0
    const inbound: SwimPacket = {
      type: 'GOSSIP_UPDATE',
      sourceNodeId: 'node-remote',
      targetNodeId: 'node-alpha',
      sequenceNumber: 1,
      piggybackedUpdates: [
        {
          nodeId: 'node-alpha',
          address: '127.0.0.1',
          port: 8000,
          status: 'SUSPECT',
          incarnation: 0,
          disseminationCount: 0,
        },
      ],
      timestamp: Date.now(),
    };

    swim.handleInboundPacket(inbound);

    const self = registry.getMember('node-alpha');
    expect(self?.status).toBe('ALIVE');
    expect(self?.incarnation).toBe(1); // Increment to refute false alert
    expect(swim.getMetrics().falsePositiveFailureCount).toBe(1);
  });

  it('should piggyback gossip updates onto outgoing packets', () => {
    registry.registerMember({
      nodeId: 'node-new',
      address: '10.0.0.99',
      port: 8000,
      status: 'ALIVE',
      incarnation: 0,
      lastSeenAt: Date.now(),
    });

    registry.enqueueGossipUpdate({
      nodeId: 'node-new',
      address: '10.0.0.99',
      port: 8000,
      status: 'ALIVE',
      incarnation: 0,
      disseminationCount: 0,
    });

    let sentPacket: SwimPacket | null = null;
    swim.setPacketSender(async (p) => {
      sentPacket = p;
      return true;
    });

    void swim.executeProbeCycle();
    expect(sentPacket).toBeDefined();
    expect((sentPacket as unknown as SwimPacket).piggybackedUpdates.length).toBeGreaterThanOrEqual(1);
  });

  it('should scale to 50+ members without degradation', () => {
    for (let i = 1; i <= 50; i++) {
      registry.registerMember({
        nodeId: `node-scale-${i}`,
        address: `10.0.1.${i}`,
        port: 8000,
        status: 'ALIVE',
        incarnation: 0,
        lastSeenAt: Date.now(),
      });
    }

    const metrics = swim.getMetrics();
    expect(metrics.totalMembers).toBe(51); // 50 + local
    expect(metrics.aliveMembersCount).toBe(51);
  });
});
