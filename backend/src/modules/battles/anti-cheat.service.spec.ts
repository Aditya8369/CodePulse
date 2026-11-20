import { BattleAntiCheatService } from './anti-cheat.service';

describe('BattleAntiCheatService', () => {
  let service: BattleAntiCheatService;

  beforeEach(() => {
    service = new BattleAntiCheatService();
  });

  it('passes normal human player reaction times and distinct IPs', () => {
    const verdict = service.evaluateBattle({
      battleId: 'b_1',
      challengerId: 'usr_1',
      opponentId: 'usr_2',
      challengerIp: '192.168.1.10',
      opponentIp: '10.0.0.5',
      reactionTimesMs: [1200, 1850, 950, 2400],
      recentMatchHistory: [],
    });

    expect(verdict.isSuspicious).toBe(false);
    expect(verdict.action).toBe('PASS');
  });

  it('flags automated bots answering in < 250ms', () => {
    const verdict = service.evaluateBattle({
      battleId: 'b_2',
      challengerId: 'usr_1',
      opponentId: 'usr_2',
      challengerIp: '192.168.1.10',
      opponentIp: '10.0.0.5',
      reactionTimesMs: [120, 115, 118, 122],
      recentMatchHistory: [],
    });

    expect(verdict.isSuspicious).toBe(true);
    expect(verdict.quarantined).toBe(true);
  });

  it('detects IP collisions between players as Sybil self-play', () => {
    const verdict = service.evaluateBattle({
      battleId: 'b_3',
      challengerId: 'usr_1',
      opponentId: 'usr_2',
      challengerIp: '203.0.113.195',
      opponentIp: '203.0.113.195',
      reactionTimesMs: [1200, 1500, 1800],
      recentMatchHistory: [],
    });

    expect(verdict.isSuspicious).toBe(true);
    expect(verdict.action).toBe('SHADOW_BAN');
  });
});
