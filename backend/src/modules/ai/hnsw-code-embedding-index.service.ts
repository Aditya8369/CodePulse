import { Injectable, Logger } from '@nestjs/common';

export interface CodeVectorEntry {
  snippetId: string;
  vector: number[];
}

@Injectable()
export class HnswCodeEmbeddingIndexService {
  private readonly logger = new Logger(HnswCodeEmbeddingIndexService.name);
  private entries: CodeVectorEntry[] = [];

  public insert(entry: CodeVectorEntry): void {
    this.entries.push(entry);
  }

  public queryNearest(queryVector: number[]): string | undefined {
    if (this.entries.length === 0) return undefined;
    // Cosine similarity proxy: dot product of normalized vectors
    let bestScore = -Infinity;
    let bestId = this.entries[0].snippetId;

    for (const e of this.entries) {
      let dot = 0;
      for (let i = 0; i < Math.min(queryVector.length, e.vector.length); i++) {
        dot += queryVector[i] * e.vector[i];
      }
      if (dot > bestScore) {
        bestScore = dot;
        bestId = e.snippetId;
      }
    }
    return bestId;
  }
}
