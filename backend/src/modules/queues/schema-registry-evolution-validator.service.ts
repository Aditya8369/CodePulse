import { Injectable, Logger } from '@nestjs/common';

export type CompatibilityMode = 'BACKWARD' | 'FORWARD' | 'FULL';

@Injectable()
export class SchemaRegistryEvolutionValidatorService {
  private readonly logger = new Logger(SchemaRegistryEvolutionValidatorService.name);

  public validateEvolution(prevFields: string[], newFields: string[], mode: CompatibilityMode = 'BACKWARD'): { isCompatible: boolean; diff: string[] } {
    const prevSet = new Set(prevFields);
    const newSet = new Set(newFields);

    if (mode === 'BACKWARD') {
      // Consumers reading new schema can still read old data -> new schema must have all previous fields or default values
      const missingInNew = prevFields.filter(f => !newSet.has(f));
      return { isCompatible: missingInNew.length === 0, diff: missingInNew };
    }

    if (mode === 'FORWARD') {
      // Old consumers can read data produced with new schema -> new fields must not break old consumers
      const addedInNew = newFields.filter(f => !prevSet.has(f));
      return { isCompatible: true, diff: addedInNew };
    }

    // FULL
    const missing = prevFields.filter(f => !newSet.has(f));
    const added = newFields.filter(f => !prevSet.has(f));
    return { isCompatible: missing.length === 0, diff: [...missing, ...added] };
  }
}
