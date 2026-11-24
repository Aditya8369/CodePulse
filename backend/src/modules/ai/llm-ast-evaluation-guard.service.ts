import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LlmAstEvaluationGuardService {
  private readonly logger = new Logger(LlmAstEvaluationGuardService.name);

  public validateLlmOutput(code: string, claimedFunctions: string[]): { isValid: boolean; hallucinatedFunctions: string[] } {
    const hallucinatedFunctions: string[] = [];
    for (const fn of claimedFunctions) {
      if (!code.includes(fn)) {
        hallucinatedFunctions.push(fn);
      }
    }
    const isValid = hallucinatedFunctions.length === 0;
    if (!isValid) {
      this.logger.warn(`LLM hallucinated non-existent symbols: ${hallucinatedFunctions.join(', ')}`);
    }
    return { isValid, hallucinatedFunctions };
  }
}
