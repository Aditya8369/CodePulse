import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';

@Injectable()
export class VerifiableDelayFunctionService {
  public computeVdf(seed: string, iterations = 1000): { output: string; iterations: number } {
    let current = seed;
    for (let i = 0; i < iterations; i++) {
      current = crypto.createHash('sha256').update(current).digest('hex');
    }
    return { output: current, iterations };
  }

  public verifyVdf(seed: string, output: string, iterations = 1000): boolean {
    const computed = this.computeVdf(seed, iterations);
    return computed.output === output;
  }
}
