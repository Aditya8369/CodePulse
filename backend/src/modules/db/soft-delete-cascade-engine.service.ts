export interface Tombstone {
  entityId: string;
  entityType: string;
  deletedAtMs: number;
  cascadedChildrenCount: number;
}

export class SoftDeleteCascadeEngineService {
  private tombstones = new Map<string, Tombstone>();

  public softDelete(entityType: string, entityId: string, childrenIds: string[]): Tombstone {
    const tombstone: Tombstone = {
      entityId,
      entityType,
      deletedAtMs: Date.now(),
      cascadedChildrenCount: childrenIds.length
    };
    this.tombstones.set(`${entityType}:${entityId}`, tombstone);
    return tombstone;
  }

  public isDeleted(entityType: string, entityId: string): boolean {
    return this.tombstones.has(`${entityType}:${entityId}`);
  }
}
