export interface SchemaField {
  name: string;
  type: string;
  tagNumber: number;
  required?: boolean;
}

export interface SchemaDefinition {
  name: string;
  version: number;
  fields: SchemaField[];
}

export type CompatibilityMode = 'BACKWARD' | 'FORWARD' | 'FULL';

/**
 * SchemaRegistryLinterService
 * Lints Protobuf & JSON event schemas against Confluent Schema Registry compatibility rules.
 */
export class SchemaRegistryLinterService {
  validateCompatibility(
    previous: SchemaDefinition,
    proposed: SchemaDefinition,
    mode: CompatibilityMode = 'BACKWARD'
  ): { compatible: boolean; violations: string[] } {
    const violations: string[] = [];
    const prevFieldMap = new Map<number, SchemaField>(previous.fields.map(f => [f.tagNumber, f]));
    const propFieldMap = new Map<number, SchemaField>(proposed.fields.map(f => [f.tagNumber, f]));

    // 1. Tag numbers must not change type
    for (const [tag, prevField] of prevFieldMap.entries()) {
      const propField = propFieldMap.get(tag);
      if (propField && propField.type !== prevField.type) {
        violations.push(
          `Field tag ${tag} ('${prevField.name}') changed type from '${prevField.type}' to '${propField.type}'`
        );
      }
    }

    // 2. BACKWARD: Consumers with old schema must parse new events
    if (mode === 'BACKWARD' || mode === 'FULL') {
      for (const [tag, prevField] of prevFieldMap.entries()) {
        if (!propFieldMap.has(tag) && prevField.required) {
          violations.push(`Required field '${prevField.name}' (tag ${tag}) was deleted in proposed schema`);
        }
      }
    }

    // 3. FORWARD: Consumers with new schema must parse old events
    if (mode === 'FORWARD' || mode === 'FULL') {
      for (const [tag, propField] of propFieldMap.entries()) {
        if (!prevFieldMap.has(tag) && propField.required) {
          violations.push(
            `New field '${propField.name}' (tag ${tag}) is marked required without default value`
          );
        }
      }
    }

    return {
      compatible: violations.length === 0,
      violations
    };
  }
}
