import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { TournamentEngineService } from './tournament-engine.service';
import type {
  VisualBracketTree,
  TournamentState,
} from './tournament-engine.service';
import {
  CreateTournamentDto,
  ReportMatchResultDto,
  ForfeitMatchDto,
} from './dto/tournament.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('tournaments')
@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentEngine: TournamentEngineService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new competitive tournament' })
  async createTournament(
    @Body() dto: CreateTournamentDto,
  ): Promise<TournamentState> {
    return this.tournamentEngine.createTournament(dto);
  }

  @Post(':id/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start a tournament and generate Round 1 match pairings' })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  async startTournament(@Param('id') id: string): Promise<TournamentState> {
    return this.tournamentEngine.startTournament(id);
  }

  @Get(':id/brackets')
  @ApiOperation({
    summary: 'Query live bracket visual tree structure, matches, and standings',
  })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  getTournamentBrackets(@Param('id') id: string): VisualBracketTree {
    return this.tournamentEngine.getBracketTree(id);
  }

  @Post(':id/matches/:matchId/result')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Report match result, update player ELO ratings, and advance brackets',
  })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiParam({ name: 'matchId', description: 'Match ID' })
  async reportMatchResult(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Body() dto: ReportMatchResultDto,
  ) {
    return this.tournamentEngine.reportMatchResult(id, matchId, dto);
  }

  @Post(':id/matches/:matchId/forfeit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Forfeit a tournament match gracefully' })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiParam({ name: 'matchId', description: 'Match ID' })
  async forfeitMatch(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Body() dto: ForfeitMatchDto,
  ) {
    return this.tournamentEngine.forfeitMatch(id, matchId, dto);
  }
}
