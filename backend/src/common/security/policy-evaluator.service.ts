export type UserRole = 'ADMIN' | 'MODERATOR' | 'ORGANIZER' | 'DEVELOPER' | 'GUEST';

export interface AuthUser {
  id: string;
  role: UserRole;
  guildId?: string;
  clanIds?: string[];
}

export type ActionType = 'read' | 'create' | 'update' | 'delete' | 'manage' | 'execute';
export type ResourceType = 'Repository' | 'Tournament' | 'Battle' | 'Guild' | 'Submission' | 'AuditLog';

export interface ResourceContext {
  id?: string;
  ownerId?: string;
  organizerId?: string;
  guildId?: string;
  isPublic?: boolean;
  status?: string;
}

/**
 * PolicyEvaluatorService
 * High-performance declarative Attribute-Based Access Control (ABAC) and RBAC matrix.
 */
export class PolicyEvaluatorService {
  can(user: AuthUser, action: ActionType, resourceType: ResourceType, resource?: ResourceContext): boolean {
    if (!user) return false;

    // 1. Super-admin override
    if (user.role === 'ADMIN') return true;

    // 2. Resource-specific policy rules
    switch (resourceType) {
      case 'Tournament':
        if (action === 'manage' || action === 'update' || action === 'delete') {
          return user.role === 'ORGANIZER' && resource?.organizerId === user.id;
        }
        if (action === 'read') return true;
        return false;

      case 'Repository':
        if (action === 'read') {
          return resource?.isPublic === true || resource?.ownerId === user.id;
        }
        if (action === 'update' || action === 'delete' || action === 'manage') {
          return resource?.ownerId === user.id;
        }
        return false;

      case 'Battle':
        if (action === 'execute' || action === 'create') {
          return user.role !== 'GUEST';
        }
        if (action === 'read') return true;
        return false;

      case 'Guild':
        if (action === 'manage') {
          return user.guildId !== undefined && user.guildId === resource?.guildId && user.role === 'ORGANIZER';
        }
        return action === 'read';

      case 'Submission':
        if (action === 'create') return user.role !== 'GUEST';
        if (action === 'read') return resource?.ownerId === user.id || user.role === 'MODERATOR';
        return false;

      case 'AuditLog':
        return user.role === 'ADMIN' || (user.role === 'MODERATOR' && action === 'read');

      default:
        return false;
    }
  }

  cannot(user: AuthUser, action: ActionType, resourceType: ResourceType, resource?: ResourceContext): boolean {
    return !this.can(user, action, resourceType, resource);
  }
}
