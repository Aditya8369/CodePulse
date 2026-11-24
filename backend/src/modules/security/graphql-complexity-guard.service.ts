import { Injectable } from '@nestjs/common';

@Injectable()
export class GraphqlComplexityGuardService {
  private readonly maxQueryDepth = 5;

  public calculateDepth(queryStr: string): number {
    let depth = 0;
    let max = 0;
    for (const char of queryStr) {
      if (char === '{') {
        depth++;
        if (depth > max) max = depth;
      } else if (char === '}') {
        depth = Math.max(0, depth - 1);
      }
    }
    return max;
  }

  public isQueryPermitted(queryStr: string): { allowed: boolean; depth: number } {
    const depth = this.calculateDepth(queryStr);
    return { allowed: depth <= this.maxQueryDepth, depth };
  }
}
