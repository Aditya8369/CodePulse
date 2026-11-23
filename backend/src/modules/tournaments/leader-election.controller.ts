import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { LeaderElectionService } from './leader-election.service';
import type {
  LeaderElectionMetrics,
  TournamentMasterStatus,
} from './leader-election.types';

@Controller('tournaments/leader')
export class LeaderElectionController {
  constructor(private readonly electionService: LeaderElectionService) {}

  @Get('status')
  public getStatus(): TournamentMasterStatus {
    return this.electionService.getStatus();
  }

  @Get('metrics')
  public getMetrics(): LeaderElectionMetrics {
    return this.electionService.getMetrics();
  }

  @Post('election')
  @HttpCode(HttpStatus.OK)
  public async triggerElection(): Promise<{ initiated: boolean }> {
    const won = await this.electionService.startElection();
    return { initiated: won };
  }

  @Post('step-down')
  @HttpCode(HttpStatus.OK)
  public stepDown(): { steppedDown: boolean } {
    this.electionService.stepDown();
    return { steppedDown: true };
  }

  @Post('peer')
  @HttpCode(HttpStatus.OK)
  public registerPeer(
    @Body() body: { nodeId: string; priority: number },
  ): { registered: boolean } {
    this.electionService.registerPeer(body.nodeId, body.priority);
    return { registered: true };
  }
}
