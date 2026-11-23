import { BadRequestException } from '@nestjs/common';
import { RaidBossService } from './raid-boss.service';

describe('RaidBossService (4-Player Cooperative Boss Raids)', () => {
  let service: RaidBossService;

  beforeEach(() => {
    service = new RaidBossService();
  });

  it('enforces a maximum squad size of 4 cooperative raiders', () => {
    const raid = service.createRaidEncounter({
      raidId: 'raid-squad-cap',
      archetype: 'MEMORY_LEAK_HYDRA',
    });

    for (let i = 1; i <= 4; i++) {
      service.joinRaid(raid.raidId, {
        userId: `user-${i}`,
        username: `coder_${i}`,
      });
    }

    expect(Object.keys(service.getEncounter(raid.raidId).participants)).toHaveLength(4);
    expect(() =>
      service.joinRaid(raid.raidId, { userId: 'user-5', username: 'coder_5' }),
    ).toThrow(BadRequestException);
  });

  it('progresses through Phase 1 (Shield), Phase 2 (O(N) Optimization), and Phase 3 (Concurrency Deadlock) to Victory with MVP rewards', () => {
    const raid = service.createRaidEncounter({
      raidId: 'raid-full-clear',
      archetype: 'RACE_CONDITION_TITAN',
    });

    // Phase 1: Break 250,000 shield via syntax & lint fixes
    const p1 = service.applyCodePatchStrike({
      raidId: raid.raidId,
      userId: 'u-1',
      username: 'sonia',
      phaseObjective: 'SYNTAX_AND_LINT',
      lintErrorsFixed: 10,
      testsPassed: 5,
      totalTests: 5,
    });
    expect(p1.encounter.currentShield).toBe(0);
    expect(p1.phaseTransitioned).toBe(true);
    expect(p1.newPhase).toBe(2);

    // Phase 2: Two O(N) algorithmic optimization strikes bring HP below 35% -> triggers Phase 3
    service.applyCodePatchStrike({
      raidId: raid.raidId,
      userId: 'u-2',
      username: 'arjun',
      phaseObjective: 'ALGORITHMIC_OPTIMIZATION',
      complexityBefore: 'O(N^2)',
      complexityAfter: 'O(N)',
    });
    const p2 = service.applyCodePatchStrike({
      raidId: raid.raidId,
      userId: 'u-2',
      username: 'arjun',
      phaseObjective: 'ALGORITHMIC_OPTIMIZATION',
      complexityBefore: 'O(N^2)',
      complexityAfter: 'O(N)',
    });
    expect(p2.newPhase).toBe(3);
    expect(p2.encounter.currentHp).toBe(280_000);

    // Phase 3: Patch concurrency deadlocks to defeat the boss
    const p3 = service.applyCodePatchStrike({
      raidId: raid.raidId,
      userId: 'u-3',
      username: 'meera',
      phaseObjective: 'CONCURRENCY_DEADLOCK_PATCH',
      deadlocksPatched: 2,
    });
    expect(p3.encounter.status).toBe('VICTORY');
    expect(p3.encounter.currentHp).toBe(0);
    expect(p3.encounter.rewards).toHaveLength(3);

    const mvp = p3.encounter.rewards.find((r) => r.isMvp);
    expect(mvp?.username).toBe('arjun');
    expect(mvp?.title).toContain('MVP');
  });

  it('triggers an enraged team wipe when the raid countdown timer reaches zero', () => {
    const raid = service.createRaidEncounter({
      raidId: 'raid-wipe-test',
      enrageDurationSeconds: 10,
    });

    const wiped = service.tickRaidTimer(raid.raidId, 10);
    expect(wiped.remainingSeconds).toBe(0);
    expect(wiped.status).toBe('WIPED');
  });

  describe('Collective Guild Raid Boss (100 Simultaneous Members)', () => {
    it('coordinates 100 simultaneous guild members attacking a shared 1,000,000 HP boss with sub-10ms state updates', () => {
      const raid = service.createRaidEncounter({
        raidId: 'guild-raid-100',
        maxPlayers: 100,
        archetype: 'MEMORY_LEAK_HYDRA',
      });

      // Generate 100 simultaneous attack contributions
      const attacks = Array.from({ length: 100 }, (_, i) => ({
        userId: `guild-member-${i + 1}`,
        username: `ClanStriker_${i + 1}`,
        damage: 10_000,
        testsPassed: 5,
      }));

      const result = service.applyConcurrentGuildDamage(raid.raidId, attacks);

      expect(result.attacksProcessed).toBe(100);
      expect(result.totalDamageDealt).toBe(1_000_000);
      expect(result.remainingHp).toBeLessThanOrEqual(250_000);
      expect(result.currentShield).toBe(0);
      expect(result.phase).toBeGreaterThanOrEqual(2);
      // Verify sub-10ms latency requirement
      expect(result.latencyMs).toBeLessThan(10);
      expect(Object.keys(service.getEncounter(raid.raidId).participants)).toHaveLength(100);
    });

    it('triggers dynamic boss spells (screen shake, code obfuscation) during battle', () => {
      const raid = service.createRaidEncounter({
        raidId: 'spell-test-raid',
        archetype: 'MEMORY_LEAK_HYDRA',
      });

      const spell = service.triggerBossSpell(
        raid.raidId,
        'SCREEN_SHAKE',
        5,
        4000,
        'Seismic tremor shakes player editor!',
      );

      expect(spell.type).toBe('SCREEN_SHAKE');
      expect(spell.intensity).toBe(5);
      const encounter = service.getEncounter(raid.raidId);
      expect(encounter.activeSpells).toHaveLength(1);
      expect(encounter.activeSpells[0].message).toContain('Seismic tremor');
    });
  });
});
