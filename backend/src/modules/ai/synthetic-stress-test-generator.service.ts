import { Injectable, Logger } from '@nestjs/common';

export interface StressTestCase {
  name: string;
  input: unknown;
  expectedEdgeType: string;
}

@Injectable()
export class SyntheticStressTestGeneratorService {
  private readonly logger = new Logger(SyntheticStressTestGeneratorService.name);

  public generateEdgeCases(paramType: string): StressTestCase[] {
    if (paramType === 'number') {
      return [
        { name: 'zero', input: 0, expectedEdgeType: 'boundary' },
        { name: 'negative_infinity', input: Number.NEGATIVE_INFINITY, expectedEdgeType: 'overflow' },
        { name: 'max_safe_integer', input: Number.MAX_SAFE_INTEGER, expectedEdgeType: 'precision' },
      ];
    }
    return [
      { name: 'empty_string', input: '', expectedEdgeType: 'null_empty' },
      { name: 'very_long_string', input: 'a'.repeat(10000), expectedEdgeType: 'stress' },
    ];
  }
}
