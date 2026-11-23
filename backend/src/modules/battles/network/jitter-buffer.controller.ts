import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { JitterBufferService } from './jitter-buffer.service';
import {
  JitterBufferMetrics,
  KeystrokePacket,
  PlayoutFrame,
} from './jitter-buffer.types';

@Controller('battles/network/jitter')
export class JitterBufferController {
  constructor(private readonly jitterService: JitterBufferService) {}

  @Get('metrics/:battleId')
  public getMetrics(@Param('battleId') battleId: string): JitterBufferMetrics {
    return this.jitterService.getMetrics(battleId);
  }

  @Post('packet')
  @HttpCode(HttpStatus.OK)
  public ingestPacket(
    @Body() packet: KeystrokePacket,
  ): {
    reorderedPacketsCount: number;
    estimatedJitterMs: number;
    targetPlayoutDelayMs: number;
  } {
    const res = this.jitterService.ingestPacket(packet);
    return {
      reorderedPacketsCount: res.reorderedPackets.length,
      estimatedJitterMs: res.estimatedJitterMs,
      targetPlayoutDelayMs: res.targetPlayoutDelayMs,
    };
  }

  @Post('playout')
  @HttpCode(HttpStatus.OK)
  public generateFrame(
    @Body() body: { battleId: string; playerId: string; timestampMs?: number },
  ): PlayoutFrame | null {
    const now = body.timestampMs ?? Date.now();
    return this.jitterService.generateNextPlayoutFrame(body.battleId, body.playerId, now);
  }

  @Post('recover-gap')
  @HttpCode(HttpStatus.OK)
  public forceGap(
    @Body() body: { battleId: string; playerId: string },
  ): { recoveredCount: number } {
    const pkts = this.jitterService.forceGapRecovery(body.battleId, body.playerId);
    return { recoveredCount: pkts.length };
  }
}
