import { Injectable } from '@nestjs/common';

export interface VectorStroke {
  strokeId: string;
  userId: string;
  color: string;
  points: Array<{ x: number; y: number }>;
}

@Injectable()
export class WhiteboardVectorMultiplexerService {
  private readonly roomStrokes = new Map<string, VectorStroke[]>();

  public appendStroke(roomId: string, stroke: VectorStroke): { totalStrokes: number } {
    const list = this.roomStrokes.get(roomId) || [];
    list.push(stroke);
    this.roomStrokes.set(roomId, list);
    return { totalStrokes: list.length };
  }

  public getRoomCanvas(roomId: string): VectorStroke[] {
    return this.roomStrokes.get(roomId) || [];
  }
}
