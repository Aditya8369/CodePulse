import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TournamentFormat {
  SINGLE_ELIMINATION = 'SINGLE_ELIMINATION',
  DOUBLE_ELIMINATION = 'DOUBLE_ELIMINATION',
  SWISS = 'SWISS',
}

export enum TournamentStatus {
  REGISTRATION = 'REGISTRATION',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TournamentMatchStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  BYE = 'BYE',
  FORFEITED = 'FORFEITED',
}

export class TournamentParticipantInputDto {
  @ApiProperty({ description: 'User ID in platform' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Display username' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiPropertyOptional({ description: 'Competitive Elo rating for seeding', default: 1200 })
  @IsNumber()
  @IsOptional()
  elo?: number;

  @ApiPropertyOptional({ description: 'Explicit seed number override' })
  @IsNumber()
  @IsOptional()
  seedNumber?: number;
}

export class CreateTournamentRequestDto {
  @ApiProperty({ description: 'Tournament title', example: 'Nexus Spring 2026 Double Elimination Championship' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: 'Tournament format (SINGLE_ELIMINATION, DOUBLE_ELIMINATION, SWISS)',
    enum: TournamentFormat,
    default: TournamentFormat.DOUBLE_ELIMINATION,
  })
  @IsEnum(TournamentFormat)
  @IsOptional()
  format?: TournamentFormat;

  @ApiPropertyOptional({ description: 'Maximum participants capacity (8, 16, 32, 64)', default: 16 })
  @IsNumber()
  @IsOptional()
  @Min(2)
  @Max(128)
  maxParticipants?: number;

  @ApiPropertyOptional({
    description: 'Initial participants list for instant seeding',
    type: [TournamentParticipantInputDto],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TournamentParticipantInputDto)
  participants?: TournamentParticipantInputDto[];

  @ApiPropertyOptional({ description: 'Scheduled start timestamp' })
  @IsOptional()
  startsAt?: string;
}

export class AdvanceMatchRequestDto {
  @ApiProperty({ description: 'User ID of the winning participant' })
  @IsString()
  @IsNotEmpty()
  winnerId: string;

  @ApiPropertyOptional({ description: 'Score achieved by player 1' })
  @IsNumber()
  @IsOptional()
  player1Score?: number;

  @ApiPropertyOptional({ description: 'Score achieved by player 2' })
  @IsNumber()
  @IsOptional()
  player2Score?: number;
}

export class TournamentMatchDto {
  @ApiProperty({ description: 'Match UUID' })
  id: string;

  @ApiProperty({ description: 'Tournament UUID' })
  tournamentId: string;

  @ApiProperty({ description: 'Round number' })
  round: number;

  @ApiProperty({ description: 'Bracket type (WINNERS, LOSERS, GRAND_FINALS)' })
  bracketType: string;

  @ApiProperty({ description: 'Match sequence number in round' })
  matchNumber: number;

  @ApiPropertyOptional({ description: 'Player 1 user ID' })
  player1Id: string | null;

  @ApiPropertyOptional({ description: 'Player 2 user ID (null if BYE)' })
  player2Id: string | null;

  @ApiPropertyOptional({ description: 'Winner user ID' })
  winnerId: string | null;

  @ApiPropertyOptional({ description: 'Loser user ID' })
  loserId: string | null;

  @ApiPropertyOptional({ description: 'Next match UUID for winner' })
  nextMatchId: string | null;

  @ApiPropertyOptional({ description: 'Next match UUID for loser (Double Elimination)' })
  nextLoserMatchId: string | null;

  @ApiProperty({ description: 'Whether this match is an automated BYE' })
  isBye: boolean;

  @ApiProperty({ description: 'Match status', enum: TournamentMatchStatus })
  status: TournamentMatchStatus;

  @ApiPropertyOptional({ description: 'Player 1 score' })
  scorePlayer1?: number;

  @ApiPropertyOptional({ description: 'Player 2 score' })
  scorePlayer2?: number;
}

export class TournamentBracketRoundDto {
  @ApiProperty({ description: 'Round number' })
  round: number;

  @ApiProperty({ description: 'Bracket designation (WINNERS, LOSERS, GRAND_FINALS)' })
  bracketType: string;

  @ApiProperty({ description: 'Matches in this round', type: [TournamentMatchDto] })
  matches: TournamentMatchDto[];
}

export class TournamentStandingDto {
  @ApiProperty({ description: 'Rank position (1st, 2nd, 3rd, etc.)' })
  rank: number;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Username' })
  username: string;

  @ApiProperty({ description: 'Seeding position' })
  seedNumber: number;

  @ApiProperty({ description: 'Elo rating' })
  elo: number;

  @ApiProperty({ description: 'Current bracket status' })
  bracket: string;

  @ApiProperty({ description: 'Whether eliminated' })
  isEliminated: boolean;
}

export class TournamentBracketViewDto {
  @ApiProperty({ description: 'Tournament UUID' })
  tournamentId: string;

  @ApiProperty({ description: 'Tournament title' })
  title: string;

  @ApiProperty({ description: 'Format', enum: TournamentFormat })
  format: TournamentFormat;

  @ApiProperty({ description: 'Status', enum: TournamentStatus })
  status: TournamentStatus;

  @ApiProperty({ description: 'Calculated bracket capacity power of two (8, 16, 32, 64)' })
  bracketCapacity: number;

  @ApiProperty({ description: 'Total participant count' })
  participantCount: number;

  @ApiProperty({ description: 'Winners bracket rounds', type: [TournamentBracketRoundDto] })
  winnersBracket: TournamentBracketRoundDto[];

  @ApiProperty({ description: 'Losers bracket rounds', type: [TournamentBracketRoundDto] })
  losersBracket: TournamentBracketRoundDto[];

  @ApiPropertyOptional({ description: 'Grand finals match', type: () => TournamentMatchDto })
  grandFinals?: TournamentMatchDto;

  @ApiProperty({ description: 'Current ranked standings', type: [TournamentStandingDto] })
  standings: TournamentStandingDto[];
}

