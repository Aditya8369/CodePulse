export interface CRDTOperation {
  type: 'INSERT' | 'DELETE';
  index: number;
  char?: string;
  clock: number;
}

export class CRDTEditorEngineService {
  private documentText: string = '';
  private currentClock: number = 0;

  public applyOperation(op: CRDTOperation): string {
    if (op.type === 'INSERT' && op.char) {
      this.documentText = this.documentText.slice(0, op.index) + op.char + this.documentText.slice(op.index);
    } else if (op.type === 'DELETE') {
      this.documentText = this.documentText.slice(0, op.index) + this.documentText.slice(op.index + 1);
    }
    this.currentClock = Math.max(this.currentClock, op.clock) + 1;
    return this.documentText;
  }

  public getText(): string {
    return this.documentText;
  }
}
