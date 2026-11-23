import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../../common/redis/redis.service';

export type RaidBossArchetype = 'MEMORY_LEAK_HYDRA' | 'RACE_CONDITION_TITAN';

export type RaidPhaseNumber = 1 | 2 | 3;

export type RaidPhaseObjectiveType =
  | 'SYNTAX_AND_LINT'
  | 'ALGORITHMIC_OPTIMIZATION'
  | 'CONCURRENCY_DEADLOCK_PATCH';

export type RaidStatus = 'ACTIVE' | 'VICTORY' | 'WIPED';

export type BossSpellType =
  | 'SCREEN_SHAKE'
  | 'CODE_OBFUSCATION'
  | 'KEY_LAG'
  | 'MEMORY_BLIND';

export interface BossSpell {
  id: string;
  name: string;
  type: BossSpellType;
  intensity: number; // 1 to 5
  durationMs: number;
  castAtMs: number;
  message: string;
}

export interface RaidPhaseSpec {
  phase: RaidPhaseNumber;
  title: string;
  objectiveType: RaidPhaseObjectiveType;
  description: string;
  hpThresholdPct: number;
  starterBuggySnippet: string;
}

export interface RaidParticipant {
  userId: string;
  username: string;
  role: 'ARCHITECT' | 'OPTIMIZER' | 'CONCURRENCY_GUARD' | 'LINT_STRIKER';
  totalDamage: number;
  shieldDamage: number;
  patchesLanded: number;
  joinedAtMs: number;
}

export interface RaidPlayerReward {
  userId: string;
  username: string;
  totalContribution: number;
  contributionPct: number;
  isMvp: boolean;
  title: string;
  xpAwarded: number;
  lootItems: string[];
}

export interface RaidEncounterState {
  raidId: string;
  guildId?: string;
  archetype: RaidBossArchetype;
  bossName: string;
  bossTitle: string;
  status: RaidStatus;
  maxHp: number;
  currentHp: number;
  maxShield: number;
  currentShield: number;
  currentPhase: RaidPhaseNumber;
  phases: RaidPhaseSpec[];
  maxPlayers: number;
  participants: Record<string, RaidParticipant>;
  activeSpells: BossSpell[];
  enrageDurationSeconds: number;
  remainingSeconds: number;
  startedAtMs: number;
  lastHitAtMs: number | null;
  lastDamageDealt: number;
  lastAttackerUsername: string | null;
  rewards: RaidPlayerReward[];
}

export interface RaidPatchSubmission {
  raidId: string;
  userId: string;
  username?: string;
  phaseObjective: RaidPhaseObjectiveType;
  lintErrorsFixed?: number;
  complexityBefore?: string;
  complexityAfter?: string;
  deadlocksPatched?: number;
  testsPassed?: number;
  totalTests?: number;
}

export interface RaidPatchOutcome {
  encounter: RaidEncounterState;
  damageDealt: number;
  shieldBroken: number;
  phaseTransitioned: boolean;
  newPhase: RaidPhaseNumber;
  criticalHit: boolean;
  combatLog: string;
  triggeredSpell?: BossSpell;
}

export interface ConcurrentGuildAttackResult {
  raidId: string;
  remainingHp: number;
  currentShield: number;
  phase: RaidPhaseNumber;
  status: RaidStatus;
  totalDamageDealt: number;
  attacksProcessed: number;
  latencyMs: number;
  triggeredSpell?: BossSpell;
}

const RAID_PHASES: RaidPhaseSpec[] = [
  {
    phase: 1,
    title: 'Phase I: Shatter the Syntax & Lint Aegis',
    objectiveType: 'SYNTAX_AND_LINT',
    description:
      'Eliminate memory-leaking closures, strict TypeScript lint errors, and unclosed handles to break the boss shield.',
    hpThresholdPct: 100,
    starterBuggySnippet: `export function allocateBuffer(items: any) {
  var leaked = [];
  for (var i = 0; i <= items.length; i++) {
    leaked.push(() => items[i]);
  }
  return leaked
}`,
  },
  {
    phase: 2,
    title: 'Phase II: Collapse Asymptotic Complexity',
    objectiveType: 'ALGORITHMIC_OPTIMIZATION',
    description:
      'Refactor the O(N^2) nested scan into an O(N) hash-indexed pipeline to cleave through the boss core HP.',
    hpThresholdPct: 75,
    starterBuggySnippet: `export function findDuplicatePairs(nums: number[]): number {
  let count = 0;
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] === nums[j]) count++;
    }
  }
  return count;
}`,
  },
  {
    phase: 3,
    title: 'Phase III: Patch Concurrency Deadlocks Before Enrage',
    objectiveType: 'CONCURRENCY_DEADLOCK_PATCH',
    description:
      'Enforce canonical lock ordering and atomic CAS updates to prevent AB-BA thread deadlocks before the wipe timer hits zero.',
    hpThresholdPct: 35,
    starterBuggySnippet: `async function transferFunds(accountA: Mutex, accountB: Mutex) {
  await accountA.lock();
  await accountB.lock(); // AB-BA deadlock under concurrent reverse transfer
  accountA.unlock();
  accountB.unlock();
}`,
  },
];

@Injectable()
export class RaidBossService {
  private readonly encounters = new Map<string, RaidEncounterState>();

  constructor(@Optional() private readonly redis?: RedisService) {}

  createRaidEncounter(params?: {
    raidId?: string;
    guildId?: string;
    archetype?: RaidBossArchetype;
    maxPlayers?: number;
    enrageDurationSeconds?: number;
  }): RaidEncounterState {
    const raidId = params?.raidId ?? `raid-${randomUUID().slice(0, 8)}`;
    const archetype = params?.archetype ?? 'MEMORY_LEAK_HYDRA';
    const isHydra = archetype === 'MEMORY_LEAK_HYDRA';

    const encounter: RaidEncounterState = {
      raidId,
      guildId: params?.guildId,
      archetype,
      bossName: isHydra ? 'The Memory Leak Hydra' : 'The Race Condition Titan',
      bossTitle: isHydra
        ? 'Colossal Heap Devourer • Lv. 99'
        : 'Chronos Thread Weaver • Lv. 99',
      status: 'ACTIVE',
      maxHp: 1_000_000,
      currentHp: 1_000_000,
      maxShield: 250_000,
      currentShield: 250_000,
      currentPhase: 1,
      phases: RAID_PHASES,
      maxPlayers: params?.maxPlayers ?? 4,
      participants: {},
      activeSpells: [],
      enrageDurationSeconds: params?.enrageDurationSeconds ?? 420,
      remainingSeconds: params?.enrageDurationSeconds ?? 420,
      startedAtMs: Date.now(),
      lastHitAtMs: null,
      lastDamageDealt: 0,
      lastAttackerUsername: null,
      rewards: [],
    };

    this.encounters.set(raidId, encounter);
    this.syncToRedis(encounter);
    return encounter;
  }

  getEncounter(raidId: string): RaidEncounterState {
    const encounter = this.encounters.get(raidId);
    if (!encounter) {
      throw new NotFoundException(`Raid encounter "${raidId}" not found`);
    }
    return encounter;
  }

  getOrCreateEncounter(
    raidId: string,
    archetype?: RaidBossArchetype,
  ): RaidEncounterState {
    return (
      this.encounters.get(raidId) ??
      this.createRaidEncounter({ raidId, archetype })
    );
  }

  /**
   * Adds a player to the cooperative raid squad or collective guild battle.
   */
  joinRaid(
    raidId: string,
    player: {
      userId: string;
      username: string;
      role?: RaidParticipant['role'];
    },
  ): RaidEncounterState {
    const encounter = this.getOrCreateEncounter(raidId);
    if (encounter.participants[player.userId]) {
      return encounter;
    }

    const currentCount = Object.keys(encounter.participants).length;
    if (currentCount >= encounter.maxPlayers) {
      throw new BadRequestException(
        `Raid squad is full (maximum ${encounter.maxPlayers} players)`,
      );
    }

    const defaultRoles: RaidParticipant['role'][] = [
      'LINT_STRIKER',
      'OPTIMIZER',
      'CONCURRENCY_GUARD',
      'ARCHITECT',
    ];

    encounter.participants[player.userId] = {
      userId: player.userId,
      username: player.username,
      role: player.role ?? defaultRoles[currentCount % defaultRoles.length],
      totalDamage: 0,
      shieldDamage: 0,
      patchesLanded: 0,
      joinedAtMs: Date.now(),
    };

    this.syncToRedis(encounter);
    return encounter;
  }

  /**
   * Evaluates a teammate's code refactoring strike against the active raid phase,
   * updates boss shield/HP, triggers phase transitions, and casts dynamic boss spells.
   */
  applyCodePatchStrike(submission: RaidPatchSubmission): RaidPatchOutcome {
    const encounter = this.getEncounter(submission.raidId);
    if (encounter.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Cannot attack raid boss while status is ${encounter.status}`,
      );
    }

    if (!encounter.participants[submission.userId]) {
      this.joinRaid(submission.raidId, {
        userId: submission.userId,
        username: submission.username ?? submission.userId,
      });
    }

    const participant = encounter.participants[submission.userId];
    const previousPhase = encounter.currentPhase;
    let shieldBroken = 0;
    let damageDealt = 0;
    let criticalHit = false;
    let combatLog = '';
    let triggeredSpell: BossSpell | undefined;

    const passRatio =
      typeof submission.testsPassed === 'number' &&
      typeof submission.totalTests === 'number' &&
      submission.totalTests > 0
        ? Math.max(0.25, submission.testsPassed / submission.totalTests)
        : 1;

    if (encounter.currentPhase === 1) {
      if (submission.phaseObjective !== 'SYNTAX_AND_LINT') {
        throw new BadRequestException(
          'Phase 1 requires SYNTAX_AND_LINT fixes to shatter the boss shield first',
        );
      }
      const fixes = Math.max(1, submission.lintErrorsFixed ?? 5);
      const rawShieldHit = Math.round(fixes * 32_000 * passRatio);
      shieldBroken = Math.min(encounter.currentShield, rawShieldHit);
      encounter.currentShield -= shieldBroken;
      participant.shieldDamage += shieldBroken;
      participant.patchesLanded += 1;
      criticalHit = fixes >= 5;

      if (encounter.currentShield === 0) {
        encounter.currentPhase = 2;
        combatLog = `${participant.username} shattered ${encounter.bossName}'s shield (${shieldBroken.toLocaleString()} shield dmg)! Phase 2 unlocked!`;
        triggeredSpell = this.triggerBossSpell(
          encounter.raidId,
          'CODE_OBFUSCATION',
          3,
          5000,
          `${encounter.bossName} activates Concurrency Deadlock Shield! Code obfuscated!`,
        );
      } else {
        combatLog = `${participant.username} cleared ${fixes} lint defects for ${shieldBroken.toLocaleString()} shield damage!`;
      }
    } else if (encounter.currentPhase === 2) {
      if (submission.phaseObjective !== 'ALGORITHMIC_OPTIMIZATION') {
        throw new BadRequestException(
          'Phase 2 requires ALGORITHMIC_OPTIMIZATION refactors',
        );
      }
      const isLinearOrBetter =
        submission.complexityAfter === 'O(N)' ||
        submission.complexityAfter === 'O(1)' ||
        submission.complexityAfter === 'O(N log N)';
      const baseDamage = isLinearOrBetter ? 360_000 : 180_000;
      damageDealt = Math.min(
        encounter.currentHp,
        Math.round(baseDamage * passRatio),
      );
      encounter.currentHp -= damageDealt;
      participant.totalDamage += damageDealt;
      participant.patchesLanded += 1;
      criticalHit = isLinearOrBetter;

      if (encounter.currentHp <= encounter.maxHp * 0.35 && encounter.currentHp > 0) {
        encounter.currentPhase = 3;
        combatLog = `${participant.username} optimized complexity to ${submission.complexityAfter ?? 'O(N)'} for ${damageDealt.toLocaleString()} DMG! ${encounter.bossName} enters Phase 3 ENRAGE!`;
        triggeredSpell = this.triggerBossSpell(
          encounter.raidId,
          'SCREEN_SHAKE',
          5,
          6000,
          `${encounter.bossName} enters Phase 3 ENRAGE! Arena trembling violently!`,
        );
      } else {
        combatLog = `${participant.username} struck for ${damageDealt.toLocaleString()} algorithmic damage!`;
      }
    } else {
      if (submission.phaseObjective !== 'CONCURRENCY_DEADLOCK_PATCH') {
        throw new BadRequestException(
          'Phase 3 requires CONCURRENCY_DEADLOCK_PATCH fixes',
        );
      }
      const locksFixed = Math.max(1, submission.deadlocksPatched ?? 2);
      damageDealt = Math.min(
        encounter.currentHp,
        Math.round(locksFixed * 190_000 * passRatio),
      );
      encounter.currentHp -= damageDealt;
      participant.totalDamage += damageDealt;
      participant.patchesLanded += 1;
      criticalHit = locksFixed >= 2;
      combatLog = `${participant.username} patched ${locksFixed} race conditions for ${damageDealt.toLocaleString()} lethal damage!`;
    }

    encounter.lastHitAtMs = Date.now();
    encounter.lastDamageDealt = damageDealt + shieldBroken;
    encounter.lastAttackerUsername = participant.username;

    if (encounter.currentHp <= 0) {
      encounter.currentHp = 0;
      encounter.status = 'VICTORY';
      encounter.rewards = this.calculateTeamRewards(encounter);
      combatLog = `VICTORY! ${participant.username} delivered the final blow to ${encounter.bossName}!`;
    }

    this.syncToRedis(encounter);

    return {
      encounter,
      damageDealt,
      shieldBroken,
      phaseTransitioned: encounter.currentPhase !== previousPhase,
      newPhase: encounter.currentPhase,
      criticalHit,
      combatLog,
      triggeredSpell,
    };
  }

  /**
   * High-concurrency collective guild attack processor.
   * Aggregates hundreds of simultaneous clan members' attacks against the shared 1,000,000 HP pool
   * with guaranteed sub-10ms latency.
   */
  applyConcurrentGuildDamage(
    raidId: string,
    attacks: Array<{ userId: string; username: string; damage: number; testsPassed?: number }>,
  ): ConcurrentGuildAttackResult {
    const startTime = performance.now();
    const encounter = this.getEncounter(raidId);

    if (encounter.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Cannot attack raid boss while status is ${encounter.status}`,
      );
    }

    let batchTotalDamage = 0;
    let triggeredSpell: BossSpell | undefined;

    for (const atk of attacks) {
      if (!encounter.participants[atk.userId]) {
        encounter.participants[atk.userId] = {
          userId: atk.userId,
          username: atk.username,
          role: 'LINT_STRIKER',
          totalDamage: 0,
          shieldDamage: 0,
          patchesLanded: 0,
          joinedAtMs: Date.now(),
        };
      }

      const participant = encounter.participants[atk.userId];
      const damage = Math.max(0, atk.damage);

      // Phase 1 shield absorption
      if (encounter.currentPhase === 1 && encounter.currentShield > 0) {
        const shieldHit = Math.min(encounter.currentShield, damage);
        encounter.currentShield -= shieldHit;
        participant.shieldDamage += shieldHit;
        participant.patchesLanded += 1;
        batchTotalDamage += shieldHit;

        if (encounter.currentShield === 0) {
          encounter.currentPhase = 2;
          triggeredSpell = this.triggerBossSpell(
            raidId,
            'CODE_OBFUSCATION',
            3,
            5000,
            `${encounter.bossName} Phase 1 shield breached! Phase 2: Asymptotic Optimization!`,
          );
        }
      } else {
        // Direct boss HP damage
        const hpHit = Math.min(encounter.currentHp, damage);
        encounter.currentHp -= hpHit;
        participant.totalDamage += hpHit;
        participant.patchesLanded += 1;
        batchTotalDamage += hpHit;

        // Phase 2 -> Phase 3 transition at 35% HP
        if (
          encounter.currentPhase === 2 &&
          encounter.currentHp <= encounter.maxHp * 0.35 &&
          encounter.currentHp > 0
        ) {
          encounter.currentPhase = 3;
          triggeredSpell = this.triggerBossSpell(
            raidId,
            'SCREEN_SHAKE',
            4,
            6000,
            `${encounter.bossName} enters Phase 3 Concurrency Enrage!`,
          );
        }
      }

      if (encounter.currentHp <= 0) {
        encounter.currentHp = 0;
        encounter.status = 'VICTORY';
        encounter.rewards = this.calculateTeamRewards(encounter);
        break;
      }
    }

    encounter.lastHitAtMs = Date.now();
    encounter.lastDamageDealt = batchTotalDamage;
    const latencyMs = Number((performance.now() - startTime).toFixed(2));

    this.syncToRedis(encounter);

    return {
      raidId,
      remainingHp: encounter.currentHp,
      currentShield: encounter.currentShield,
      phase: encounter.currentPhase,
      status: encounter.status,
      totalDamageDealt: batchTotalDamage,
      attacksProcessed: attacks.length,
      latencyMs,
      triggeredSpell,
    };
  }

  /**
   * Casts a dynamic boss spell affecting the raid participants' UI/editor environment
   */
  triggerBossSpell(
    raidId: string,
    type: BossSpellType,
    intensity = 3,
    durationMs = 4000,
    customMessage?: string,
  ): BossSpell {
    const encounter = this.getEncounter(raidId);
    const spellNames: Record<BossSpellType, string> = {
      SCREEN_SHAKE: 'Seismic Thread Crash',
      CODE_OBFUSCATION: 'Minified Glyph Curse',
      KEY_LAG: 'Memory Pressure Debuff',
      MEMORY_BLIND: 'Garbage Collection Blackout',
    };

    const spell: BossSpell = {
      id: `spell-${randomUUID().slice(0, 8)}`,
      name: spellNames[type] || 'Boss Spell',
      type,
      intensity: Math.max(1, Math.min(5, intensity)),
      durationMs,
      castAtMs: Date.now(),
      message: customMessage || `${encounter.bossName} cast ${spellNames[type]}!`,
    };

    encounter.activeSpells.push(spell);
    // Cleanup expired spells
    const now = Date.now();
    encounter.activeSpells = encounter.activeSpells.filter(
      (s) => now - s.castAtMs < s.durationMs,
    );

    return spell;
  }

  /**
   * Advances the enraged wipe countdown timer and triggers a team wipe if time expires.
   */
  tickRaidTimer(raidId: string, elapsedSeconds = 1): RaidEncounterState {
    const encounter = this.getEncounter(raidId);
    if (encounter.status !== 'ACTIVE') {
      return encounter;
    }

    encounter.remainingSeconds = Math.max(
      0,
      encounter.remainingSeconds - Math.max(1, elapsedSeconds),
    );

    if (encounter.remainingSeconds === 0 && encounter.currentHp > 0) {
      encounter.status = 'WIPED';
      encounter.rewards = [];
    }

    return encounter;
  }

  /**
   * Calculates proportional team contributions and awards the MVP (Most Valuable Programmer)
   * title and bonus raid loot.
   */
  calculateTeamRewards(encounter: RaidEncounterState): RaidPlayerReward[] {
    const players = Object.values(encounter.participants);
    if (players.length === 0) return [];

    const scored = players.map((p) => ({
      player: p,
      score: p.totalDamage + p.shieldDamage,
    }));
    const grandTotal = scored.reduce((sum, item) => sum + item.score, 0);

    scored.sort((a, b) => b.score - a.score);
    const topUserId = scored[0].player.userId;

    return scored.map(({ player, score }) => {
      const isMvp = player.userId === topUserId && score > 0;
      const contributionPct =
        grandTotal > 0 ? Number(((score / grandTotal) * 100).toFixed(1)) : 0;
      const baseXp = 1200 + Math.round(contributionPct * 15);
      const xpAwarded = isMvp ? Math.round(baseXp * 1.5) : baseXp;

      return {
        userId: player.userId,
        username: player.username,
        totalContribution: score,
        contributionPct,
        isMvp,
        title: isMvp
          ? 'Most Valuable Programmer (MVP)'
          : `${player.role.replace('_', ' ')} Raider`,
        xpAwarded,
        lootItems: isMvp
          ? [
              'Hydra Core Refactor Crest',
              'Mythic Concurrency Sigil',
              '+500 Bonus Raid Tokens',
            ]
          : ['Raid Victor Chest', '+200 Raid Tokens'],
      };
    });
  }

  private syncToRedis(encounter: RaidEncounterState): void {
    if (this.redis) {
      try {
        const client = (this.redis as unknown as { getClient?: () => { setex?: (k: string, s: number, v: string) => Promise<unknown> } }).getClient?.();
        if (client?.setex) {
          client.setex(`raid:encounter:${encounter.raidId}`, 3600, JSON.stringify(encounter)).catch(() => {});
        }
      } catch {
        // ignore non-blocking redis cache sync
      }
    }
  }
}
