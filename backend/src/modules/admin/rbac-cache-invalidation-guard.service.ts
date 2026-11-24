import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RbacCacheInvalidationGuardService {
  private readonly logger = new Logger(RbacCacheInvalidationGuardService.name);
  private cache = new Map<string, any>();
  private childToParents = new Map<string, Set<string>>();

  public registerRelation(childRole: string, parentRole: string): void {
    if (!this.childToParents.has(childRole)) {
      this.childToParents.set(childRole, new Set());
    }
    this.childToParents.get(childRole)!.add(parentRole);
  }

  public setCache(key: string, val: any): void {
    this.cache.set(key, val);
  }

  public invalidateRoleHierarchy(role: string): number {
    let evicted = 0;
    if (this.cache.has(role)) {
      this.cache.delete(role);
      evicted++;
    }

    // Cascade to all parent roles that inherit this child
    const parents = this.childToParents.get(role);
    if (parents) {
      for (const p of parents) {
        if (this.cache.has(p)) {
          this.cache.delete(p);
          evicted++;
        }
      }
    }

    this.logger.log(`Invalidated ${evicted} cache entries across role ${role} hierarchy.`);
    return evicted;
  }
}
