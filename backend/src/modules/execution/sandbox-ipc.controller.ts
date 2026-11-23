import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ZeroCopyIpcService } from '../../common/concurrency/zero-copy-ipc.service';
import {
  ChannelAllocationOptions,
  SandboxStreamType,
  ZeroCopyIpcMetrics,
} from '../../common/concurrency/zero-copy-ipc.types';

@Controller('execution/sandbox-ipc')
export class SandboxIpcController {
  constructor(private readonly ipcService: ZeroCopyIpcService) {}

  @Post('channel')
  @HttpCode(HttpStatus.OK)
  public acquireChannel(
    @Body() options: ChannelAllocationOptions,
  ): { channelId: string; slotCapacity: number; slotSizeBytes: number } {
    const desc = this.ipcService.acquireExecutionChannel(options);
    return {
      channelId: desc.channelId,
      slotCapacity: desc.slotCapacity,
      slotSizeBytes: desc.slotSizeBytes,
    };
  }

  @Post('channel/:executionId/release')
  @HttpCode(HttpStatus.OK)
  public releaseChannel(
    @Param('executionId') executionId: string,
  ): { released: boolean } {
    this.ipcService.releaseExecutionChannel(executionId);
    return { released: true };
  }

  @Post('channel/:executionId/write')
  @HttpCode(HttpStatus.OK)
  public writeChunk(
    @Param('executionId') executionId: string,
    @Body() body: { type: SandboxStreamType; data: string },
  ): { written: boolean } {
    const rawBytes = new TextEncoder().encode(body.data);
    const written = this.ipcService.writeStreamChunk(executionId, body.type, rawBytes);
    return { written };
  }

  @Get('metrics')
  public getMetrics(): ZeroCopyIpcMetrics {
    return this.ipcService.getMetrics();
  }
}
