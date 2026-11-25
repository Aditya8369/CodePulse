/**
 * Architecture Service 39: Multi-Master Operational Transformation
 * Subsystem: State Synchronization Engine
 */

export interface TextOperation {
  type: 'INSERT' | 'DELETE';
  position: number;
  text?: string;
  length?: number;
}

export class OperationalTransformationService {
  public transform(op1: TextOperation, op2: TextOperation): [TextOperation, TextOperation] {
    // Basic OT transformation for concurrent text inserts
    if (op1.type === 'INSERT' && op2.type === 'INSERT') {
      if (op1.position < op2.position) {
        return [
          op1,
          { ...op2, position: op2.position + (op1.text?.length || 0) },
        ];
      } else {
        return [
          { ...op1, position: op1.position + (op2.text?.length || 0) },
          op2,
        ];
      }
    }
    return [op1, op2];
  }

  public apply(baseText: string, op: TextOperation): string {
    if (op.type === 'INSERT' && op.text) {
      return baseText.slice(0, op.position) + op.text + baseText.slice(op.position);
    }
    return baseText;
  }
}
