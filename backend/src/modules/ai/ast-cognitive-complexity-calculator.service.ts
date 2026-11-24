import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AstCognitiveComplexityCalculatorService {
  private readonly logger = new Logger(AstCognitiveComplexityCalculatorService.name);

  public calculateComplexity(controlFlowStatementsCount: number, nestingDepth: number): number {
    const score = controlFlowStatementsCount + nestingDepth * 2;
    this.logger.log(`Computed cognitive complexity score: ${score}`);
    return score;
  }
}
