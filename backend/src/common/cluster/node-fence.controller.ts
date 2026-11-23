import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ClusterPartitionStatus,
  NodeFenceState,
  NodeHeartbeatPayload,
  PartitionSimulationDto,
  SplitBrainMetrics,
} from './cluster.types';
import { SplitBrainDetectorService } from './split-brain-detector.service';

/**
 * NodeFenceController
 *
 * Exposes cluster partition telemetry, health heartbeats, and chaos partition injection endpoints.
 */
@Controller('cluster/split-brain')
export class NodeFenceController {
  constructor(private readonly splitBrainService: SplitBrainDetectorService) {}

  @Get('status')
  public getStatus(): ClusterPartitionStatus {
    return this.splitBrainService.evaluateQuorumAndFence();
  }

  @Get('metrics')
  public getMetrics(): SplitBrainMetrics {
    return this.splitBrainService.getMetrics();
  }

  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  public recordHeartbeat(@Body() payload: NodeHeartbeatPayload): { acknowledged: boolean } {
    this.splitBrainService.recordHeartbeat(payload);
    return { acknowledged: true };
  }

  @Post('simulate-partition')
  @HttpCode(HttpStatus.OK)
  public simulatePartition(
    @Body() dto: PartitionSimulationDto,
  ): { simulated: boolean; status: ClusterPartitionStatus } {
    this.splitBrainService.simulatePartition(dto.targetNodeIds, dto.isolateLocalNode ?? false);
    const status = this.splitBrainService.evaluateQuorumAndFence();
    return { simulated: true, status };
  }

  @Post('heal-partition')
  @HttpCode(HttpStatus.OK)
  public healPartition(): { healed: boolean; status: ClusterPartitionStatus } {
    this.splitBrainService.healPartition();
    const status = this.splitBrainService.evaluateQuorumAndFence();
    return { healed: true, status };
  }

  @Post('fence')
  @HttpCode(HttpStatus.OK)
  public forceFence(
    @Body() body: { state: NodeFenceState },
  ): { state: NodeFenceState } {
    this.splitBrainService.forceFence(body.state);
    return { state: this.splitBrainService.getFenceState() };
  }
}
