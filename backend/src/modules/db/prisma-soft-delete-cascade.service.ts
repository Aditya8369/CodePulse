import { Injectable } from '@nestjs/common';

@Injectable()
export class PrismaSoftDeleteCascadeService {
  public computeCascadedEntities(entityType: string, entityId: string): Array<{ type: string; foreignKey: string; parentId: string }> {
    if (entityType === 'User') {
      return [
        { type: 'Profile', foreignKey: 'userId', parentId: entityId },
        { type: 'GuildMembership', foreignKey: 'userId', parentId: entityId },
        { type: 'MatchHistory', foreignKey: 'userId', parentId: entityId },
      ];
    }
    return [];
  }
}
