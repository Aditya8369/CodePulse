import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GuildRoleRbacPoisonGuardService {
  private readonly logger = new Logger(GuildRoleRbacPoisonGuardService.name);
  private roleHierarchy = new Map<string, string[]>(); // role -> parent roles
  private rolePermissions = new Map<string, Set<string>>(); // role -> permissions

  public setRoleHierarchy(role: string, parents: string[]): void {
    this.roleHierarchy.set(role, [...parents]);
  }

  public setRolePermissions(role: string, permissions: string[]): void {
    this.rolePermissions.set(role, new Set(permissions));
  }

  public resolvePermissions(role: string): Set<string> {
    const visited = new Set<string>();
    const resolved = new Set<string>();

    const traverse = (currentRole: string) => {
      if (visited.has(currentRole)) {
        this.logger.warn(`Cyclic role inheritance detected at ${currentRole}, aborting cycle branch.`);
        return;
      }
      visited.add(currentRole);

      const perms = this.rolePermissions.get(currentRole);
      if (perms) {
        perms.forEach(p => resolved.add(p));
      }

      const parents = this.roleHierarchy.get(currentRole) || [];
      for (const parent of parents) {
        traverse(parent);
      }
    };

    traverse(role);
    return new Set(resolved); // Immutable copy prevents cache poisoning
  }
}
