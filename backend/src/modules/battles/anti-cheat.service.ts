import { Injectable, Logger } from '@nestjs/common';

export interface BattleAuditPayload {
  battleId: string;
  challengerId: string;
  opponentId: string;
  challengerIp: string;
  opponentIp: string;
  reactionTimesMs: number[]; // response time per question
  recentMatchHistory: Array<{ opponentId: string; forfeited: boolean; timestamp: number }>;
}

export interface AntiCheatVerdict {
  isSuspicious: boolean;
  quarantined: boolean;
  reasons: string[];
  action: 'PASS' | 'QUARANTINE' | 'SHADOW_BAN';
}

@Injectable()
export class BattleAntiCheatService {
  private readonly logger = new Logger(BattleAntiCheatService.name);

  /**
   * Analyzes reaction time entropy, win-trading pairs, and subnet collisions
   */
  evaluateBattle(payload: BattleAuditPayload): AntiCheatVerdict {
    const reasons: string[] = [];

    // 1. IP / Subnet Collision Check (Sybil attack / self-play)
    if (payload.challengerIp && payload.opponentIp && payload.challengerIp === payload.opponentIp) {
      reasons.push('Identical IP address detected between challenger and opponent.');
    }

    // 2. Reaction Time Entropy & Inhuman Speed (< 250ms with zero variance)
    if (payload.reactionTimesMs.length >= 3) {
      const avgReaction =
        payload.reactionTimesMs.reduce((a, b) => a + b, 0) / payload.reactionTimesMs.length;

      if (avgReaction < 250) {
        reasons.push(`Inhuman average reaction time detected: ${avgReaction.toFixed(0)}ms.`);
      }

      const variance =
        payload.reactionTimesMs.reduce((sum, val) => sum + Math.pow(val - avgReaction, 2), 0) /
        payload.reactionTimesMs.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev < 15 && avgReaction < 600) {
        reasons.push(`Bot-like mechanical timing detected with near-zero std deviation (${stdDev.toFixed(1)}ms).`);
      }
    }

    // 3. Win-Trading Collusion Detector (> 3 matches against same opponent in 2h with forfeits)
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const recentAgainstOpponent = payload.recentMatchHistory.filter(
      m => m.opponentId === payload.opponentId && m.timestamp > twoHoursAgo
    );

    if (recentAgainstOpponent.length >= 3) {
      const forfeitCount = recentAgainstOpponent.filter(m => m.forfeited).length;
      if (forfeitCount >= 2) {
        reasons.push(`Win-trading pattern identified: ${recentAgainstOpponent.length} repetitive matches with ${forfeitCount} forfeits in 2 hours.`);
      }
    }

    const isSuspicious = reasons.length > 0;
    let action: AntiCheatVerdict['action'] = 'PASS';

    if (reasons.some(r => r.includes('Identical IP') || r.includes('Win-trading'))) {
      action = 'SHADOW_BAN';
    } else if (isSuspicious) {
      action = 'QUARANTINE';
    }

    if (isSuspicious) {
      this.logger.warn(`Battle ${payload.battleId} flagged by Anti-Cheat: ${reasons.join(' | ')}`);
    }

    return {
      isSuspicious,
      quarantined: action !== 'PASS',
      reasons,
      action,
    };
  }
}
