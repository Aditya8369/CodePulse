/**
 * Architecture Service 59: Event Stream Schema Registry Evolution Validator
 * Subsystem: Backward Compatibility Rules
 */

export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
}

export interface StreamSchema {
  version: number;
  fields: SchemaField[];
}

export class SchemaEvolutionValidatorService {
  public validateBackwardCompatibility(oldSchema: StreamSchema, newSchema: StreamSchema): { compatible: boolean; reason?: string } {
    const oldFieldMap = new Map(oldSchema.fields.map(f => [f.name, f]));

    // Backward compatibility rule 1: Existing required fields cannot be deleted
    for (const [name, oldField] of oldFieldMap.entries()) {
      const newField = newSchema.fields.find(f => f.name === name);
      if (!newField && oldField.required) {
        return { compatible: false, reason: 'Required field ' + name + ' was deleted' };
      }
    }

    // Backward compatibility rule 2: Newly added fields must NOT be required (or must have defaults)
    for (const newField of newSchema.fields) {
      if (!oldFieldMap.has(newField.name) && newField.required) {
        return { compatible: false, reason: 'New field ' + newField.name + ' cannot be required' };
      }
    }

    return { compatible: true };
  }
}
