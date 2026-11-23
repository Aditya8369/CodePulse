import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { NodeRegistryService } from './node-registry.service';
import { SwimGossipService } from './swim-gossip.service';
import type { SwimClusterMetrics, SwimMember } from './swim-gossip.types';

@Controller('cluster/swim')
export class SwimGossipController {
  constructor(
    private readonly swimService: SwimGossipService,
    private readonly registry: NodeRegistryService,
  ) {}

  @Get('members')
  public getMembers(): SwimMember[] {
    return this.registry.getAllMembers();
  }

  @Get('metrics')
  public getMetrics(): SwimClusterMetrics {
    return this.swimService.getMetrics();
  }

  @Post('join')
  @HttpCode(HttpStatus.OK)
  public joinSeed(
    @Body() body: { nodeId: string; address: string; port: number },
  ): { joined: boolean } {
    this.registry.registerMember({
      nodeId: body.nodeId,
      address: body.address,
      port: body.port,
      status: 'ALIVE',
      incarnation: 0,
      lastSeenAt: Date.now(),
    });
    return { joined: true };
  }

  @Post('probe')
  @HttpCode(HttpStatus.OK)
  public async triggerProbe(): Promise<{
    targetNodeId?: string;
    directAck: boolean;
    indirectAck: boolean;
  }> {
    return this.swimService.executeProbeCycle();
  }
}
