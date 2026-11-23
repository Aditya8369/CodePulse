import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { EventLoopWatchdogService } from './event-loop-watchdog.service';
import type {
  EventLoopLagStatus,
  TaskSharderMetrics,
} from './event-loop.types';
import { TaskSharderService } from './task-sharder.service';

@Controller('performance/event-loop')
export class EventLoopWatchdogController {
  constructor(
    private readonly watchdog: EventLoopWatchdogService,
    private readonly taskSharder: TaskSharderService,
  ) {}

  @Get('status')
  public getStatus(): EventLoopLagStatus {
    return this.watchdog.getStatus();
  }

  @Get('metrics')
  public getMetrics(): TaskSharderMetrics {
    return this.taskSharder.getMetrics();
  }

  @Post('benchmark')
  @HttpCode(HttpStatus.OK)
  public async runBenchmark(
    @Body() body: { itemCount?: number; chunkDurationMs?: number },
  ): Promise<{
    processedCount: number;
    durationMs: number;
    metrics: TaskSharderMetrics;
    lagStatus: EventLoopLagStatus;
  }> {
    const total = body.itemCount ?? 1000;
    const items = Array.from({ length: total }, (_, i) => i);
    const start = performance.now();

    // Process simulated AST token parsing with cooperative sharding
    await this.taskSharder.processSharded(
      items,
      (item) => {
        // Light computational burn
        let sum = 0;
        for (let j = 0; j < 500; j++) {
          sum += Math.sqrt(j + item);
        }
        return sum;
      },
      { maxChunkDurationMs: body.chunkDurationMs ?? 4 },
    );

    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    return {
      processedCount: total,
      durationMs,
      metrics: this.taskSharder.getMetrics(),
      lagStatus: this.watchdog.getStatus(),
    };
  }
}
