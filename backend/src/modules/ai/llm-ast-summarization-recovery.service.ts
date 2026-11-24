import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LlmAstSummarizationRecoveryService {
  private readonly logger = new Logger(LlmAstSummarizationRecoveryService.name);
  private readonly maxTokens = 4000;

  public summarizeSource(code: string, estimatedTokens: number): { summarizedCode: string; compressed: boolean } {
    if (estimatedTokens > this.maxTokens) {
      this.logger.warn(`Context size ${estimatedTokens} > ${this.maxTokens}. Extracting interface skeletons.`);
      const skeleton = code.split('{')[0] + '{ /* body stripped */ }';
      return { summarizedCode: skeleton, compressed: true };
    }
    return { summarizedCode: code, compressed: false };
  }
}
