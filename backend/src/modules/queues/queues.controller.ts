import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QueuesAdminGuard } from './queues-admin.guard';
import { DeadLetterQueueService } from './dlq.service';
@ApiTags('admin-queues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, QueuesAdminGuard)
@Controller('admin/queues')
export class QueuesController {
  constructor(private readonly dlq: DeadLetterQueueService) {}
  @Post('dlq/replay')
  replay(@Body() body: { ids?: unknown }) {
    return this.dlq.replay(body?.ids);
  }
  @Get('metrics')
  async metrics(@Res() response: Response) {
    // Send directly so the global JSON-envelope interceptor does not wrap metrics.
    response.type('text/plain; version=0.0.4').send(await this.dlq.metrics());
  }
}
