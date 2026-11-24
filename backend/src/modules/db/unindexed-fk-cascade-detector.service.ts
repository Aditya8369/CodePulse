import { Injectable } from '@nestjs/common';

export interface ForeignKeyDefinition {
  constraintName: string;
  sourceTable: string;
  foreignTable: string;
  foreignColumn: string;
  hasIndex: boolean;
  onDeleteCascade: boolean;
}

@Injectable()
export class UnindexedFkCascadeDetectorService {
  public findHazardousCascades(fks: ForeignKeyDefinition[]): ForeignKeyDefinition[] {
    // Unindexed foreign keys with ON DELETE CASCADE cause full table locks on deletion
    return fks.filter((fk) => fk.onDeleteCascade && !fk.hasIndex);
  }
}
