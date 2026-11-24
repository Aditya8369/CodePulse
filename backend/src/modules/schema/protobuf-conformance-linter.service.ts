export interface ProtoField {
  tagNumber: number;
  name: string;
  type: string;
  rule?: 'optional' | 'required' | 'repeated';
}

export interface ProtoSchema {
  version: string;
  messageName: string;
  fields: ProtoField[];
}

export interface ConformanceViolation {
  code: 'TAG_NUMBER_REUSED' | 'REQUIRED_FIELD_REMOVED' | 'TYPE_MUTATION_INCOMPATIBLE';
  message: string;
  fieldTag: number;
}

export class ProtobufConformanceLinterService {
  public validateCompatibility(oldSchema: ProtoSchema, newSchema: ProtoSchema): ConformanceViolation[] {
    const violations: ConformanceViolation[] = [];
    const oldFieldMap = new Map<number, ProtoField>();
    for (const f of oldSchema.fields) {
      oldFieldMap.set(f.tagNumber, f);
    }

    const newFieldMap = new Map<number, ProtoField>();
    for (const f of newSchema.fields) {
      newFieldMap.set(f.tagNumber, f);
    }

    // 1. Check for removed required fields
    for (const [tag, oldField] of oldFieldMap.entries()) {
      if (oldField.rule === 'required' && !newFieldMap.has(tag)) {
        violations.push({
          code: 'REQUIRED_FIELD_REMOVED',
          message: `Required field '${oldField.name}' (tag ${tag}) was removed in new schema.`,
          fieldTag: tag
        });
      }
    }

    // 2. Check for tag re-use with different names or incompatible types
    for (const [tag, newField] of newFieldMap.entries()) {
      if (oldFieldMap.has(tag)) {
        const oldField = oldFieldMap.get(tag)!;
        if (oldField.name !== newField.name) {
          violations.push({
            code: 'TAG_NUMBER_REUSED',
            message: `Tag ${tag} renamed from '${oldField.name}' to '${newField.name}'. Tag numbers must be reserved.`,
            fieldTag: tag
          });
        }
        if (oldField.type !== newField.type) {
          violations.push({
            code: 'TYPE_MUTATION_INCOMPATIBLE',
            message: `Field '${newField.name}' changed type from '${oldField.type}' to '${newField.type}'.`,
            fieldTag: tag
          });
        }
      }
    }

    return violations;
  }
}
