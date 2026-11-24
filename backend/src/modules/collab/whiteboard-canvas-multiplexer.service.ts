export interface CanvasElement {
  id: string;
  type: string;
  x: number;
  y: number;
}

export class WhiteboardCanvasMultiplexerService {
  private elements = new Map<string, CanvasElement>();

  public updateElement(element: CanvasElement): void {
    this.elements.set(element.id, element);
  }

  public deleteElement(id: string): void {
    this.elements.delete(id);
  }

  public getSnapshot(): CanvasElement[] {
    return Array.from(this.elements.values());
  }
}
