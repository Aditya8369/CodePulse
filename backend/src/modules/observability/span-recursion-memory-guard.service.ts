import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SpanRecursionMemoryGuardService {
  private readonly logger = new Logger(SpanRecursionMemoryGuardService.name);
  private readonly maxSpanDepth = 64;

  public checkSpanRecursionDepth(currentDepth: number): { allowSpanCreation: boolean } {
    if (currentDepth > this.maxSpanDepth) {
      this.logger.error(`Recursion depth limit breached (${currentDepth} > ${this.maxSpanDepth}). Truncating span child creation to avoid OOM.`);
      return { allowSpanCreation: false };
    }
    return { allowSpanCreation: true };
  }
}
