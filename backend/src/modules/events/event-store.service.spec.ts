import { EventStoreService } from './event-store.service';
import { BattleReadProjection } from './projections/battle-read.projection';
import { EloReadProjection } from './projections/elo-read.projection';

describe('EventStoreService & CQRS Projections (#1057)', () => {
  let eventStore: EventStoreService;
  let battleProjection: BattleReadProjection;
  let eloProjection: EloReadProjection;

  beforeEach(() => {
    eventStore = new EventStoreService();
    battleProjection = new BattleReadProjection(eventStore);
    battleProjection.onModuleInit();
    eloProjection = new EloReadProjection(eventStore);
    eloProjection.onModuleInit();
  });

  afterEach(() => {
    eventStore.clear();
    battleProjection.clear();
    eloProjection.clear();
  });

  it('appends immutable events with incremental sequence numbers', () => {
    const ev1 = eventStore.appendEvent('battle-1057', 'BattleCreated', { title: '1v1 Showdown' });
    const ev2 = eventStore.appendEvent('battle-1057', 'PlayerJoined', { userId: 'alice', username: 'Alice' });

    expect(ev1.sequenceNumber).toBe(1);
    expect(ev2.sequenceNumber).toBe(2);
    expect(eventStore.getEvents('battle-1057')).toHaveLength(2);
  });

  it('reconstructs battle state frame-by-frame via event replay', () => {
    const battleId = 'battle-replay-1';

    eventStore.appendEvent(battleId, 'BattleCreated', {});
    eventStore.appendEvent(battleId, 'PlayerJoined', { userId: 'p1', username: 'PlayerOne' });
    eventStore.appendEvent(battleId, 'PlayerJoined', { userId: 'p2', username: 'PlayerTwo' });
    eventStore.appendEvent(battleId, 'PlayerReady', { userId: 'p1' });
    eventStore.appendEvent(battleId, 'PlayerReady', { userId: 'p2' });
    eventStore.appendEvent(battleId, 'KeystrokeBatchRecorded', { userId: 'p1', count: 120 });
    eventStore.appendEvent(battleId, 'TestCaseEvaluated', { userId: 'p1', passed: true, score: 100 });
    eventStore.appendEvent(battleId, 'MatchEnded', { winnerUserId: 'p1' });

    // Full replay
    const finalState = eventStore.replayBattleState(battleId);
    expect(finalState.status).toBe('COMPLETED');
    expect(finalState.winnerUserId).toBe('p1');
    expect(finalState.players['p1'].keystrokeCount).toBe(120);
    expect(finalState.players['p1'].testCasesPassed).toBe(1);
    expect(finalState.lastEventSequence).toBe(8);

    // Partial replay up to sequence 4 (before second player ready and keystrokes)
    const midState = eventStore.replayBattleState(battleId, 4);
    expect(midState.status).toBe('INITIALIZING');
    expect(midState.players['p1'].keystrokeCount).toBe(0);
    expect(midState.lastEventSequence).toBe(4);
  });

  it('updates denormalized read models in BattleReadProjection and EloReadProjection', () => {
    const battleId = 'battle-proj-1';

    eventStore.appendEvent(battleId, 'BattleCreated', {});
    eventStore.appendEvent(battleId, 'PlayerJoined', { userId: 'u1', username: 'Ace' });
    eventStore.appendEvent(battleId, 'PlayerJoined', { userId: 'u2', username: 'King' });
    eventStore.appendEvent(battleId, 'PlayerReady', { userId: 'u1' });
    eventStore.appendEvent(battleId, 'PlayerReady', { userId: 'u2' });
    eventStore.appendEvent(battleId, 'KeystrokeBatchRecorded', { userId: 'u1', count: 45 });
    eventStore.appendEvent(battleId, 'MatchEnded', {
      winnerUserId: 'u1',
      loserUserId: 'u2',
      eloDelta: 30,
    });

    // Verify Battle Read Model
    const battleModel = battleProjection.getBattle(battleId);
    expect(battleModel).toBeDefined();
    expect(battleModel?.status).toBe('COMPLETED');
    expect(battleModel?.winnerUserId).toBe('u1');
    expect(battleModel?.totalKeystrokes).toBe(45);

    // Verify ELO Read Model
    expect(eloProjection.getUserElo('u1')).toBe(1230); // 1200 + 30
    expect(eloProjection.getUserElo('u2')).toBe(1170); // 1200 - 30

    const leaderboard = eloProjection.getLeaderboard(5);
    expect(leaderboard[0].userId).toBe('u1');
    expect(leaderboard[0].wins).toBe(1);
  });
});
