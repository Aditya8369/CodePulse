import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

export type RaidBossArchetype = 'MEMORY_LEAK_HYDRA' | 'RACE_CONDITION_TITAN';

export type RaidPhaseNumber = 1 | 2 | 3;

export type RaidPhaseObjectiveType =
  | 'SYNTAX_AND_LINT'
  | 'ALGORITHMIC_OPTIMIZATION'
  | 'CONCURRENCY_DEADLOCK_PATCH';

export type RaidStatus = 'ACTIVE' | 'VICTORY' | 'WIPED';

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

  createRaidEncounter(params?: {
    raidId?: string;
    archetype?: RaidBossArchetype;
    enrageDurationSeconds?: number;
  }): RaidEncounterState {
    const raidId = params?.raidId ?? `raid-${randomUUID().slice(0, 8)}`;
    const archetype = params?.archetype ?? 'MEMORY_LEAK_HYDRA';
    const isHydra = archetype === 'MEMORY_LEAK_HYDRA';

    const encounter: RaidEncounterState = {
      raidId,
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
      maxPlayers: 4,
      participants: {},
      enrageDurationSeconds: params?.enrageDurationSeconds ?? 420,
      remainingSeconds: params?.enrageDurationSeconds ?? 420,
      startedAtMs: Date.now(),
      lastHitAtMs: null,
      lastDamageDealt: 0,
      lastAttackerUsername: null,
      rewards: [],
    };

    this.encounters.set(raidId, encounter);
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
   * Adds a player to the 4-player cooperative raid squad.
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

    return encounter;
  }

  /**
   * Evaluates a teammate's code refactoring strike against the active raid phase,
   * updates boss shield/HP, triggers phase transitions, and distributes victory loot.
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

    return {
      encounter,
      damageDealt,
      shieldBroken,
      phaseTransitioned: encounter.currentPhase !== previousPhase,
      newPhase: encounter.currentPhase,
      criticalHit,
      combatLog,
    };
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
}
