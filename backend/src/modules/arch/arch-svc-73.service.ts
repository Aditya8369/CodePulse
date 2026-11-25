/**
 * Architecture Service 73: Hierarchical RBAC Role Inheritance Caching Engine
 * Subsystem: Real-Time Invalidation
 */

export class HierarchicalRbacCacheService {
  private roleHierarchy = new Map<string, string[]>(); // role -> parentRoles
  private permissions = new Map<string, Set<string>>(); // role -> direct permissions
  private resolvedCache = new Map<string, Set<string>>(); // role -> all inherited permissions

  public defineRole(role: string, parentRoles: string[], directPermissions: string[]): void {
    this.roleHierarchy.set(role, parentRoles);
    this.permissions.set(role, new Set(directPermissions));
    this.resolvedCache.clear(); // invalidate cached hierarchies
  }

  public getEffectivePermissions(role: string): Set<string> {
    const cached = this.resolvedCache.get(role);
    if (cached) return cached;

    const effective = new Set<string>(this.permissions.get(role) || []);
    const parents = this.roleHierarchy.get(role) || [];

    for (const parent of parents) {
      const parentPerms = this.getEffectivePermissions(parent);
      for (const p of parentPerms) {
        effective.add(p);
      }
    }

    this.resolvedCache.set(role, effective);
    return effective;
  }

  public hasPermission(role: string, permission: string): boolean {
    return this.getEffectivePermissions(role).has(permission);
  }
}
