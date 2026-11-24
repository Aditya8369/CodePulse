import { Injectable } from '@nestjs/common';

@Injectable()
export class PrismaBatchSplitterService {
  private readonly defaultBatchLimit = 500;

  public chunkOperations<T>(items: T[], batchSize = this.defaultBatchLimit): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      chunks.push(items.slice(i, i + batchSize));
    }
    return chunks;
  }
}
