import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MonacoLspTokenizationPipelineService {
  private readonly logger = new Logger(MonacoLspTokenizationPipelineService.name);

  public chunkTokenization(totalLines: number, chunkSize = 1000): { totalChunks: number; processedChunks: number } {
    const totalChunks = Math.ceil(totalLines / chunkSize);
    this.logger.log(`Divided ${totalLines} lines into ${totalChunks} incremental LSP semantic token chunks.`);
    return { totalChunks, processedChunks: totalChunks };
  }
}
