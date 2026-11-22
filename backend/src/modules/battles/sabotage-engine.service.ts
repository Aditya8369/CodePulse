import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

export type SabotageType =
  | 'SYNTAX_FOG'
  | 'VARIABLE_SWAP'
  | 'INVERTED_BOOLEAN'
  | 'TEST_SCRAMBLER';

export type DefenseType = 'CLEANSE_SHIELD' | 'CODE_FORMAT_PURGE';

export interface PowerupConfig {
  type: SabotageType | DefenseType;
  name: string;
  category: 'OFFENSIVE' | 'DEFENSIVE';
  cost: number;
  description: string;
  durationMs: number;
  icon: string;
}

export const SABOTAGE_POWERUPS: Record<SabotageType | DefenseType, PowerupConfig> = {
  SYNTAX_FOG: {
    type: 'SYNTAX_FOG',
    name: 'Syntax Fog',
    category: 'OFFENSIVE',
    cost: 100,
    description: 'Pollutes code with confounding fog comments and bracket noise',
    durationMs: 30000,
    icon: '🌫️',
  },
  VARIABLE_SWAP: {
    type: 'VARIABLE_SWAP',
    name: 'Variable Swap',
    category: 'OFFENSIVE',
    cost: 150,
    description: 'Inverts local variable identifiers across the function scope',
    durationMs: 30000,
    icon: '🔀',
  },
  INVERTED_BOOLEAN: {
    type: 'INVERTED_BOOLEAN',
    name: 'Inverted Boolean',
    category: 'OFFENSIVE',
    cost: 200,
    description: 'Flips conditional comparison operators (=== to !==, true to false)',
    durationMs: 30000,
    icon: '🔄',
  },
  TEST_SCRAMBLER: {
    type: 'TEST_SCRAMBLER',
    name: 'Test Scrambler',
    category: 'OFFENSIVE',
    cost: 250,
    description: 'Perturbs test case order and injects adversarial boundary conditions',
    durationMs: 30000,
    icon: '🧪',
  },
  CLEANSE_SHIELD: {
    type: 'CLEANSE_SHIELD',
    name: 'Cleanse Shield',
    category: 'DEFENSIVE',
    cost: 120,
    description: 'Defensive energy barrier that absorbs the next incoming sabotage attack',
    durationMs: 45000,
    icon: '🛡️',
  },
  CODE_FORMAT_PURGE: {
    type: 'CODE_FORMAT_PURGE',
    name: 'Code Format Purge',
    category: 'DEFENSIVE',
    cost: 100,
    description: 'Instantly purges all active sabotages and restores pristine code buffer',
    durationMs: 0,
    icon: '✨',
  },
};

export interface ActiveSabotageEffect {
  id: string;
  battleId: string;
  attackerId: string;
  attackerUsername: string;
  targetId: string;
  targetUsername: string;
  powerupType: SabotageType;
  originalCode: string;
  mutatedCode: string;
  appliedAt: number;
  expiresAt: number;
  isExpired: boolean;
  blockedByShield: boolean;
}

export interface PlayerBattleState {
  userId: string;
  username: string;
  powerupPoints: number;
  hasShield: boolean;
  activeSabotages: ActiveSabotageEffect[];
}

export interface SabotageAuditLog {
  id: string;
  battleId: string;
  timestamp: number;
  attackerId: string;
  targetId: string;
  powerupType: SabotageType | DefenseType;
  outcome: 'DEPLOYED' | 'DEFLECTED' | 'PURGED' | 'EXPIRED';
  codeHashBefore: string;
  codeHashAfter: string;
  details: string;
}

export interface DeploySabotageInput {
  battleId: string;
  attackerId: string;
  attackerUsername: string;
  targetId: string;
  targetUsername: string;
  powerupType: SabotageType;
  currentCode: string;
}

export interface DeploySabotageResult {
  success: boolean;
  deflected: boolean;
  mutatedCode: string;
  bannerMessage: string;
  remainingPoints: number;
  effect?: ActiveSabotageEffect;
}

export interface ActivateDefenseInput {
  battleId: string;
  userId: string;
  username: string;
  defenseType: DefenseType;
  currentCode: string;
}

export interface ActivateDefenseResult {
  success: boolean;
  remainingPoints: number;
  purgedCount?: number;
  restoredCode?: string;
  bannerMessage?: string;
}

@Injectable()
export class SabotageEngineService {
  private readonly logger = new Logger(SabotageEngineService.name);
  private playerStates: Map<string, PlayerBattleState> = new Map();
  private auditLogs: Map<string, SabotageAuditLog[]> = new Map();

  public resetState(): void {
    this.playerStates.clear();
    this.auditLogs.clear();
  }

  public getOrCreatePlayerState(battleId: string, userId: string, username: string = ''): PlayerBattleState {
    const key = `${battleId}:${userId}`;
    let state = this.playerStates.get(key);
    if (!state) {
      state = {
        userId,
        username,
        powerupPoints: 300,
        hasShield: false,
        activeSabotages: [],
      };
      this.playerStates.set(key, state);
    }
    if (username && !state.username) {
      state.username = username;
    }
    return state;
  }

  public awardPoints(battleId: string, userId: string, points: number): number {
    const state = this.getOrCreatePlayerState(battleId, userId);
    state.powerupPoints += points;
    return state.powerupPoints;
  }

  public applySyntaxFog(source: string): string {
    return `// SYNTAX FOG: adversarial obfuscation active /* 🌫️ 🌫️ */\n${source}`;
  }

  public applyVariableSwap(source: string): string {
    if (/\bleft\b/.test(source) && /\bright\b/.test(source)) {
      return source
        .replace(/\bleft\b/g, '__TEMP_RIGHT__')
        .replace(/\bright\b/g, 'left')
        .replace(/__TEMP_RIGHT__/g, 'right');
    }
    return source;
  }

  public applyInvertedBoolean(source: string): string {
    return source
      .replace(/===/g, '!==')
      .replace(/\btrue\b/g, '__TEMP_FALSE__')
      .replace(/\bfalse\b/g, 'true')
      .replace(/__TEMP_FALSE__/g, 'false');
  }

  public applyTestScrambler(source: string): string {
    return `// TEST SCRAMBLER: boundary conditions randomized\n${source.replace(/\.toBe\(/g, '.toEqual(')}`;
  }

  public deploySabotage(input: DeploySabotageInput): DeploySabotageResult {
    const { battleId, attackerId, attackerUsername, targetId, targetUsername, powerupType, currentCode } = input;
    const attacker = this.getOrCreatePlayerState(battleId, attackerId, attackerUsername);
    const target = this.getOrCreatePlayerState(battleId, targetId, targetUsername);
    const config = SABOTAGE_POWERUPS[powerupType];

    if (attacker.powerupPoints < config.cost) {
      throw new BadRequestException('Insufficient powerup points to deploy sabotage');
    }

    attacker.powerupPoints -= config.cost;
    const codeHashBefore = this.hash(currentCode);

    // Check if target is protected by Cleanse Shield
    if (target.hasShield) {
      target.hasShield = false; // Shield absorbs and pops
      const banner = `${targetUsername} deflected ${attackerUsername}'s ${config.name} with Cleanse Shield`;
      this.recordAudit({
        id: crypto.randomUUID(),
        battleId,
        timestamp: Date.now(),
        attackerId,
        targetId,
        powerupType,
        outcome: 'DEFLECTED',
        codeHashBefore,
        codeHashAfter: codeHashBefore,
        details: banner,
      });

      return {
        success: true,
        deflected: true,
        mutatedCode: currentCode,
        bannerMessage: banner,
        remainingPoints: attacker.powerupPoints,
      };
    }

    // Apply AST code mutation
    let mutatedCode = currentCode;
    switch (powerupType) {
      case 'SYNTAX_FOG':
        mutatedCode = this.applySyntaxFog(currentCode);
        break;
      case 'VARIABLE_SWAP':
        mutatedCode = this.applyVariableSwap(currentCode);
        break;
      case 'INVERTED_BOOLEAN':
        mutatedCode = this.applyInvertedBoolean(currentCode);
        break;
      case 'TEST_SCRAMBLER':
        mutatedCode = this.applyTestScrambler(currentCode);
        break;
    }

    const effect: ActiveSabotageEffect = {
      id: crypto.randomUUID(),
      battleId,
      attackerId,
      attackerUsername,
      targetId,
      targetUsername,
      powerupType,
      originalCode: currentCode,
      mutatedCode,
      appliedAt: Date.now(),
      expiresAt: Date.now() + config.durationMs,
      isExpired: false,
      blockedByShield: false,
    };

    target.activeSabotages.push(effect);

    const bannerMessage =
      powerupType === 'SYNTAX_FOG'
        ? `${attackerUsername} blinded ${targetUsername} with a thick cloud of Syntax Fog`
        : `${attackerUsername} cast ${config.name} on ${targetUsername}`;

    this.recordAudit({
      id: crypto.randomUUID(),
      battleId,
      timestamp: Date.now(),
      attackerId,
      targetId,
      powerupType,
      outcome: 'DEPLOYED',
      codeHashBefore,
      codeHashAfter: this.hash(mutatedCode),
      details: bannerMessage,
    });

    return {
      success: true,
      deflected: false,
      mutatedCode,
      bannerMessage,
      remainingPoints: attacker.powerupPoints,
      effect,
    };
  }

  public activateDefense(input: ActivateDefenseInput): ActivateDefenseResult {
    const { battleId, userId, username, defenseType, currentCode } = input;
    const user = this.getOrCreatePlayerState(battleId, userId, username);
    const config = SABOTAGE_POWERUPS[defenseType];

    if (user.powerupPoints < config.cost) {
      throw new BadRequestException('Insufficient powerup points for defensive powerup');
    }

    user.powerupPoints -= config.cost;

    if (defenseType === 'CLEANSE_SHIELD') {
      user.hasShield = true;
      return {
        success: true,
        remainingPoints: user.powerupPoints,
      };
    }

    if (defenseType === 'CODE_FORMAT_PURGE') {
      const purgedCount = user.activeSabotages.length;
      const restoredCode = user.activeSabotages.length > 0 ? user.activeSabotages[0].originalCode : currentCode;
      user.activeSabotages = [];

      this.recordAudit({
        id: crypto.randomUUID(),
        battleId,
        timestamp: Date.now(),
        attackerId: userId,
        targetId: userId,
        powerupType: defenseType,
        outcome: 'PURGED',
        codeHashBefore: this.hash(currentCode),
        codeHashAfter: this.hash(restoredCode),
        details: `${username} activated Code Format Purge, cleansing ${purgedCount} sabotages`,
      });

      return {
        success: true,
        purgedCount,
        restoredCode,
        bannerMessage: `${username} activated Code Format Purge and restored pristine code`,
        remainingPoints: user.powerupPoints,
      };
    }

    return {
      success: true,
      remainingPoints: user.powerupPoints,
    };
  }

  public getActiveSabotages(battleId: string, userId: string): ActiveSabotageEffect[] {
    const state = this.getOrCreatePlayerState(battleId, userId);
    const now = Date.now();
    return state.activeSabotages.filter((s) => !s.isExpired && s.expiresAt > now);
  }

  public getAuditLogs(battleId: string): SabotageAuditLog[] {
    return this.auditLogs.get(battleId) || [];
  }

  public cleanupExpiredSabotages(currentTime: number = Date.now()): ActiveSabotageEffect[] {
    const expiredList: ActiveSabotageEffect[] = [];

    for (const [key, state] of this.playerStates.entries()) {
      const remaining: ActiveSabotageEffect[] = [];
      for (const sabotage of state.activeSabotages) {
        if (sabotage.expiresAt <= currentTime) {
          sabotage.isExpired = true;
          expiredList.push(sabotage);

          this.recordAudit({
            id: crypto.randomUUID(),
            battleId: sabotage.battleId,
            timestamp: currentTime,
            attackerId: sabotage.attackerId,
            targetId: sabotage.targetId,
            powerupType: sabotage.powerupType,
            outcome: 'EXPIRED',
            codeHashBefore: this.hash(sabotage.mutatedCode),
            codeHashAfter: this.hash(sabotage.originalCode),
            details: `Sabotage ${sabotage.powerupType} on ${sabotage.targetUsername} expired naturally`,
          });
        } else {
          remaining.push(sabotage);
        }
      }
      state.activeSabotages = remaining;
    }

    return expiredList;
  }

  private recordAudit(log: SabotageAuditLog): void {
    const list = this.auditLogs.get(log.battleId) || [];
    list.push(log);
    this.auditLogs.set(log.battleId, list);
  }

  private hash(content: string): string {
    return crypto.createHash('sha256').update(content || '').digest('hex').substring(0, 16);
  }
}
