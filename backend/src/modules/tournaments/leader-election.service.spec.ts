import { ServiceUnavailableException } from '@nestjs/common';
import { LeaderElectionService } from './leader-election.service';
import { BullyMessage } from './leader-election.types';

describe('LeaderElectionService', () => {
  let leaderNode: LeaderElectionService;
  let followerNode: LeaderElectionService;

  beforeEach(() => {
    leaderNode = new LeaderElectionService({
      localNodeId: 'node-high-prio',
      priority: 900,
      heartbeatIntervalMs: 50,
      leaseDurationMs: 200,
      electionTimeoutMs: 150,
      minQuorumAcks: 1,
    });

    followerNode = new LeaderElectionService({
      localNodeId: 'node-low-prio',
      priority: 100,
      heartbeatIntervalMs: 50,
      leaseDurationMs: 200,
      electionTimeoutMs: 150,
      minQuorumAcks: 1,
    });
  });

  afterEach(() => {
    leaderNode.onModuleDestroy();
    followerNode.onModuleDestroy();
  });

  it('should allow highest priority node to immediately win election', async () => {
    leaderNode.registerPeer('node-low-prio', 100);

    const won = await leaderNode.startElection();
    expect(won).toBe(true);
    expect(leaderNode.getRole()).toBe('LEADER');
    expect(leaderNode.isLeader()).toBe(true);
    expect(() => leaderNode.assertLeader()).not.toThrow();
  });

  it('should finish election in sub-300ms benchmark', async () => {
    const start = Date.now();
    await leaderNode.startElection();
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(300);
    expect(leaderNode.getMetrics().averageElectionDurationMs).toBeLessThan(300);
  });

  it('should bully lower-priority candidate when election message is received', () => {
    const electionMsg: BullyMessage = {
      type: 'ELECTION',
      senderId: 'node-low-prio',
      senderPriority: 100,
      term: 1,
      timestamp: Date.now(),
    };

    const reply = leaderNode.handleInboundMessage(electionMsg);
    expect(reply).not.toBeNull();
    expect(reply?.type).toBe('ANSWER');
    expect(reply?.senderPriority).toBe(900);
  });

  it('should reject tournament bracket mutation when node is not active leader', () => {
    expect(() => followerNode.assertLeader()).toThrow(ServiceUnavailableException);
  });

  it('should automatically step down when leader is isolated from peers', async () => {
    leaderNode.registerPeer('peer-1', 200);
    await leaderNode.startElection();
    expect(leaderNode.isLeader()).toBe(true);

    // Simulate network partition where heartbeat sends fail
    leaderNode.setMessageSender(async () => false);

    await leaderNode.sendHeartbeatLease();
    expect(leaderNode.getRole()).toBe('STEPPED_DOWN');
    expect(leaderNode.isLeader()).toBe(false);
    expect(leaderNode.getMetrics().totalStepDowns).toBe(1);
  });

  it('should extend sliding-window lease on coordinator / heartbeat reception', () => {
    const coordMsg: BullyMessage = {
      type: 'COORDINATOR',
      senderId: 'node-high-prio',
      senderPriority: 900,
      term: 1,
      leaseDurationMs: 500,
      timestamp: Date.now(),
    };

    followerNode.handleInboundMessage(coordMsg);
    const status = followerNode.getStatus();
    expect(status.currentLeaderId).toBe('node-high-prio');
    expect(status.currentLeaderPriority).toBe(900);
    expect(status.leaseRemainingMs).toBeGreaterThan(0);
  });
});
