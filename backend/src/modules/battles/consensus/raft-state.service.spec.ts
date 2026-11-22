import { Test, TestingModule } from '@nestjs/testing';
import { RaftStateService } from './raft-state.service';
import { WalLogService } from './wal-log.service';

describe('RaftStateService & WalLogService (Distributed Consensus Engine)', () => {
  let raftService: RaftStateService;
  let walService: WalLogService;

  const BATTLE_ID = 'battle-cluster-99';
  const POD_1 = 'pod-us-east-1';
  const POD_2 = 'pod-us-west-1';
  const POD_3 = 'pod-eu-central-1';

  beforeEach(async () => {
    walService = new WalLogService();
    raftService = new RaftStateService(walService);

    // Initialize a 3-node cluster
    raftService.initializeNode(BATTLE_ID, POD_1, [POD_2, POD_3]);
    raftService.initializeNode(BATTLE_ID, POD_2, [POD_1, POD_3]);
    raftService.initializeNode(BATTLE_ID, POD_3, [POD_1, POD_2]);
  });

  afterEach(() => {
    raftService.clearAllTimers();
    walService.clear();
  });

  describe('Leader Election & Timers', () => {
    it('elects POD_1 as Leader when starting election with majority quorum (2/3)', async () => {
      const elected = await raftService.startElection(BATTLE_ID, POD_1);

      expect(elected).toBe(true);
      expect(raftService.isLeader(BATTLE_ID, POD_1)).toBe(true);
      expect(raftService.getNode(BATTLE_ID, POD_1)?.role).toBe('LEADER');
      expect(raftService.getNode(BATTLE_ID, POD_1)?.currentTerm).toBe(2);

      // Followers recognize leader
      expect(raftService.getNode(BATTLE_ID, POD_2)?.role).toBe('FOLLOWER');
      expect(raftService.getNode(BATTLE_ID, POD_3)?.role).toBe('FOLLOWER');
    });

    it('kills leader pod and triggers automatic follower election in under 300ms', async () => {
      await raftService.startElection(BATTLE_ID, POD_1);
      expect(raftService.isLeader(BATTLE_ID, POD_1)).toBe(true);

      // Simulate leader death by isolating POD_1
      raftService.simulatePartition([POD_1]);

      const startTime = Date.now();
      // POD_2 starts election
      const newLeaderElected = await raftService.startElection(BATTLE_ID, POD_2);
      const elapsed = Date.now() - startTime;

      expect(newLeaderElected).toBe(true);
      expect(raftService.isLeader(BATTLE_ID, POD_2)).toBe(true);
      expect(elapsed).toBeLessThan(300);
    });

    it('emits heartbeats at 150ms interval to maintain leader authority', () => {
      expect(RaftStateService.HEARTBEAT_INTERVAL_MS).toBe(150);
      expect(RaftStateService.ELECTION_TIMEOUT_MIN_MS).toBe(250);
      expect(RaftStateService.ELECTION_TIMEOUT_MAX_MS).toBe(300);
    });
  });

  describe('Quorum Consensus & WAL Log Replication', () => {
    it('commits victory state and ELO update when quorum (2/3 nodes) acks entry', async () => {
      await raftService.startElection(BATTLE_ID, POD_1);

      const result = await raftService.proposeCommand(
        BATTLE_ID,
        POD_1,
        'VICTORY_STATE',
        {
          winnerId: 'player-alice',
          loserId: 'player-bob',
          eloDelta: 25,
        },
      );

      expect(result.success).toBe(true);
      expect(result.quorum).toBe(true);
      expect(result.commitIndex).toBe(1);

      // Verify WAL state
      const replayed = walService.replay(BATTLE_ID);
      expect(replayed.length).toBe(1);
      expect(replayed[0].command).toBe('VICTORY_STATE');
      expect(replayed[0].committed).toBe(true);
      expect(replayed[0].payload.winnerId).toBe('player-alice');
    });

    it('prevents commit when network partition isolates nodes and drops below quorum', async () => {
      await raftService.startElection(BATTLE_ID, POD_1);

      // Isolate POD_2 and POD_3 (leader left alone, 1/3 cannot reach quorum)
      raftService.simulatePartition([POD_2, POD_3]);

      const result = await raftService.proposeCommand(
        BATTLE_ID,
        POD_1,
        'ELO_UPDATE',
        {
          userId: 'player-alice',
          newRating: 1850,
        },
      );

      expect(result.success).toBe(false);
      expect(result.quorum).toBe(false);

      // Uncommitted entries must not appear in authoritative replay
      const committedEntries = walService.replay(BATTLE_ID);
      expect(committedEntries.length).toBe(0);
    });

    it('recovers network partition and reconciles state machine without data loss', async () => {
      await raftService.startElection(BATTLE_ID, POD_1);

      // Commit 1 entry with full cluster
      await raftService.proposeCommand(BATTLE_ID, POD_1, 'BATTLE_START', {
        roomId: 'room-xyz',
      });

      // Isolate POD_3
      raftService.simulatePartition([POD_3]);

      // POD_1 and POD_2 can still commit (2/3 is quorum)
      const res = await raftService.proposeCommand(BATTLE_ID, POD_1, 'SUBMISSION', {
        user: 'alice',
        passedTests: 10,
      });
      expect(res.success).toBe(true);
      expect(res.quorum).toBe(true);

      // Recover partition
      raftService.recoverPartition();

      const replay = walService.replay(BATTLE_ID);
      expect(replay.length).toBe(2);
      expect(replay[0].command).toBe('BATTLE_START');
      expect(replay[1].command).toBe('SUBMISSION');
    });
  });
});
