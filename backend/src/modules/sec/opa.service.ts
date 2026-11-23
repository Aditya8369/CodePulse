import { Injectable, Logger, Optional } from '@nestjs/common';
import * as crypto from 'crypto';

export type SystemRole = 'ADMIN' | 'MODERATOR' | 'MENTOR' | 'PLAYER';

export interface SubjectContext {
  id: string;
  role: SystemRole | string;
  roles?: string[];
  clanId?: string;
  trustScore?: number;
}

export interface ResourceContext {
  type: string;
  id?: string;
  ownerId?: string;
  clanId?: string;
  status?: string;
}

export interface OpaEvaluationRequest {
  subject: SubjectContext;
  action: string;
  resource: ResourceContext;
  context?: Record<string, unknown>;
}

export interface AuditDecisionLog {
  decisionId: string;
  timestamp: string;
  allowed: boolean;
  subjectId: string;
  role: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  reason: string;
  policyVersion: string;
}

export interface DynamicPolicyRule {
  id: string;
  roles: string[];
  actions: string[];
  resourceTypes: string[];
  minTrustScore?: number;
  requireOwnership?: boolean;
}

@Injectable()
export class OpaService {
  private readonly logger = new Logger(OpaService.name);

  private policyVersion = 'v1.0.0';
  private readonly auditLogs: AuditDecisionLog[] = [];
  private rules: DynamicPolicyRule[] = [];

  constructor() {
    this.initializeDefaultPolicies();
  }

  private initializeDefaultPolicies(): void {
    // Declarative RBAC / ABAC rules for Admin, Moderator, Mentor, Player
    this.rules = [
      {
        id: 'admin-wildcard-access',
        roles: ['ADMIN', 'SUPER_ADMIN'],
        actions: ['*'],
        resourceTypes: ['*'],
      },
      {
        id: 'moderator-discipline',
        roles: ['MODERATOR'],
        actions: ['ban_user', 'mute_user', 'review_dispute', 'view_cheat_logs', 'resolve_dispute'],
        resourceTypes: ['user', 'dispute', 'battle'],
      },
      {
        id: 'mentor-shadow-coding',
        roles: ['MENTOR'],
        actions: ['shadow_code', 'review_submission', 'award_mentee_xp', 'comment_code'],
        resourceTypes: ['mentorship_session', 'submission', 'challenge'],
        minTrustScore: 70,
      },
      {
        id: 'player-battle-actions',
        roles: ['PLAYER', 'USER'],
        actions: ['join_battle', 'submit_code', 'view_bracket', 'spectate', 'pledge_wager'],
        resourceTypes: ['battle', 'tournament', 'wager'],
      },
      {
        id: 'owner-resource-mutation',
        roles: ['PLAYER', 'USER', 'MENTOR'],
        actions: ['update_profile', 'delete_key', 'edit_clan'],
        resourceTypes: ['profile', 'api_key', 'clan'],
        requireOwnership: true,
      },
    ];
  }

  /**
   * Evaluates authorization decision using declarative rules and ABAC context.
   */
  public evaluate(request: OpaEvaluationRequest): {
    allowed: boolean;
    reason: string;
    decisionId: string;
  } {
    const { subject, action, resource } = request;
    const userRole = (subject.role || 'PLAYER').toUpperCase();
    const userRoles = subject.roles?.map((r) => r.toUpperCase()) || [userRole];
    const trustScore = subject.trustScore ?? 100;
    const isOwner = Boolean(resource.ownerId && resource.ownerId === subject.id);

    let allowed = false;
    let reason = 'Default deny: no matching policy rule permitting action';

    for (const rule of this.rules) {
      const roleMatches =
        rule.roles.includes('*') || rule.roles.some((r) => userRoles.includes(r));
      const actionMatches = rule.actions.includes('*') || rule.actions.includes(action);
      const resourceMatches =
        rule.resourceTypes.includes('*') || rule.resourceTypes.includes(resource.type);

      if (roleMatches && actionMatches && resourceMatches) {
        // Evaluate ABAC constraints
        if (rule.minTrustScore !== undefined && trustScore < rule.minTrustScore) {
          reason = `Deny: trust score ${trustScore} is below required threshold of ${rule.minTrustScore}`;
          continue;
        }

        if (rule.requireOwnership && !isOwner) {
          reason = `Deny: user does not own resource ${resource.id || resource.type}`;
          continue;
        }

        allowed = true;
        reason = `Allowed by rule: ${rule.id}`;
        break;
      }
    }

    // Generate cryptographic decision ID and record to immutable audit trail
    const decisionId = `opa-${crypto.randomUUID()}`;
    const logEntry: AuditDecisionLog = {
      decisionId,
      timestamp: new Date().toISOString(),
      allowed,
      subjectId: subject.id,
      role: userRole,
      action,
      resourceType: resource.type,
      resourceId: resource.id,
      reason,
      policyVersion: this.policyVersion,
    };

    this.auditLogs.push(logEntry);
    if (this.auditLogs.length > 2000) {
      this.auditLogs.shift();
    }

    return { allowed, reason, decisionId };
  }

  /**
   * Dynamically updates or reloads policies taking effect instantly without restarting backend servers.
   */
  public updatePolicies(newRules: DynamicPolicyRule[], version?: string): void {
    this.rules = [...newRules];
    this.policyVersion = version || `v1.0.0-${Date.now()}`;
    this.logger.log(`OPA policy updated to version ${this.policyVersion} (${this.rules.length} active rules)`);
  }

  public getPolicyVersion(): string {
    return this.policyVersion;
  }

  public getAuditLogs(): readonly AuditDecisionLog[] {
    return this.auditLogs;
  }

  public getAuditLogByDecisionId(decisionId: string): AuditDecisionLog | undefined {
    return this.auditLogs.find((l) => l.decisionId === decisionId);
  }
}
