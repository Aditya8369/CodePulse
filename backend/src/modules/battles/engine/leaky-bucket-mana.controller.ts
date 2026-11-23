import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { LeakyBucketManaService } from './leaky-bucket-mana.service';
import { LeakyBucketMetrics, ResourceDepletionRequest, ResourceDepletionResult } from './leaky-bucket-mana.types';

@Controller('battles/engine/mana-rate')
export class LeakyBucketManaController {
  constructor(private readonly rateService: LeakyBucketManaService) {}

  @Get('metrics')
  public getMetrics(): LeakyBucketMetrics {
    return this.rateService.getMetrics();
  }

  @Post('deplete')
  @HttpCode(HttpStatus.OK)
  public tryDeplete(@Body() req: ResourceDepletionRequest): ResourceDepletionResult {
    return this.rateService.tryDeplete(req);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  public reset(@Body() body: { playerId: string; resource: ResourceDepletionRequest['resource'] }): { reset: boolean } {
    this.rateService.resetBucket(body.playerId, body.resource);
    return { reset: true };
  }
}
