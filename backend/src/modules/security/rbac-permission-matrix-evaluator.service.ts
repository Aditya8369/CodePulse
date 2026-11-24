import { Injectable } from '@nestjs/common';

@Injectable()
export class RbacPermissionMatrixEvaluatorService {
  private readonly rolePermissions: Record<string, Set<string>> = {
    ADMIN: new Set(['READ', 'WRITE', 'DELETE', 'MANAGE_GUILDS']),
    MODERATOR: new Set(['READ', 'WRITE', 'FLAG']),
    USER: new Set(['READ', 'WRITE']),
  };

  public hasPermission(role: string, requiredPermission: string): boolean {
    const permissions = this.rolePermissions[role.toUpperCase()];
    if (!permissions) return false;
    return permissions.has(requiredPermission);
  }
}
