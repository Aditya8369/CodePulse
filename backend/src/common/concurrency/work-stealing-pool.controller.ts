import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { WorkStealingPoolService } from './work-stealing-pool.service';
import type {
  TestCasePayload,
  TestCaseResult,
  WorkStealingPoolMetrics,
} from './work-stealing.types';

@Controller('execution/work-stealing')
export class WorkStealingPoolController {
  constructor(private readonly poolService: WorkStealingPoolService) {}

  @Get('metrics')
  public getMetrics(): WorkStealingPoolMetrics {
    return this.poolService.getMetrics();
  }

  @Post('evaluate-batch')
  @HttpCode(HttpStatus.OK)
  public async evaluateBatch(
    @Body() body: { testCases: TestCasePayload[] },
  ): Promise<{ results: TestCaseResult[]; metrics: WorkStealingPoolMetrics }> {
    const results = await this.poolService.evaluateBatchTestCases(
      body.testCases,
      async (tc) => {
        // Simulated algorithmic test evaluation
        return tc.input.length > 0;
      },
    );

    return {
      results,
      metrics: this.poolService.getMetrics(),
    };
  }
}
