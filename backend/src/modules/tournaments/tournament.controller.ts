import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TournamentService } from './tournament.service';
import {
  CreateTournamentRequestDto,
  AdvanceMatchRequestDto,
  TournamentBracketViewDto,
} from './dto/tournament.dto';

@ApiTags('tournaments')
@Controller('tournaments')
export class TournamentController {
  constructor(private readonly tournamentService: TournamentService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create a new Single or Double Elimination tournament with Elo-based seeding',
    description:
      'Computes nearest power-of-two bracket capacity (8, 16, 32, 64), seeds participants by Elo rating, pre-wires Winners/Losers brackets, and auto-resolves initial byes.',
  })
  @ApiResponse({ status: 200, type: TournamentBracketViewDto })
  async createTournament(
    @Body() dto: CreateTournamentRequestDto,
  ): Promise<TournamentBracketViewDto> {
    return this.tournamentService.createTournament(dto);
  }

  @Get(':id/bracket')
  @ApiOperation({
    summary: 'Query live bracket visual tree structure, rounds, matches, and standings',
  })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiResponse({ status: 200, type: TournamentBracketViewDto })
  getTournamentBracket(@Param('id') id: string): TournamentBracketViewDto {
    return this.tournamentService.getBracket(id);
  }

  @Get(':id/brackets')
  @ApiOperation({
    summary: 'Alias endpoint to query live bracket visual tree structure',
  })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiResponse({ status: 200, type: TournamentBracketViewDto })
  getTournamentBracketsAlias(@Param('id') id: string): TournamentBracketViewDto {
    return this.tournamentService.getBracket(id);
  }

  @Post(':id/matches/:matchId/advance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Advance tournament match outcome, route winner to next Winners round, and route loser to Losers bracket',
  })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiParam({ name: 'matchId', description: 'Match ID' })
  @ApiResponse({ status: 200, type: TournamentBracketViewDto })
  async advanceMatch(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Body() dto: AdvanceMatchRequestDto,
  ): Promise<TournamentBracketViewDto> {
    return this.tournamentService.advanceMatch(id, matchId, dto);
  }

  @Post(':id/matches/:matchId/result')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Alias endpoint to report match result and advance brackets',
  })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiParam({ name: 'matchId', description: 'Match ID' })
  @ApiResponse({ status: 200, type: TournamentBracketViewDto })
  async reportMatchResult(
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Body() dto: AdvanceMatchRequestDto,
  ): Promise<TournamentBracketViewDto> {
    return this.tournamentService.advanceMatch(id, matchId, dto);
  }
}

