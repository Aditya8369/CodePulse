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
} from 'class-validator';

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
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FORFEITED = 'FORFEITED',
  BYE = 'BYE',
}

export class CreateTournamentParticipantDto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Display username' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiPropertyOptional({ description: 'Initial seeding order' })
  @IsNumber()
  @IsOptional()
  seed?: number;

  @ApiPropertyOptional({ description: 'Current player ELO rating', default: 1200 })
  @IsNumber()
  @IsOptional()
  elo?: number;
}

export class CreateTournamentDto {
  @ApiProperty({ description: 'Tournament title' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: TournamentFormat, default: TournamentFormat.SWISS })
  @IsEnum(TournamentFormat)
  format: TournamentFormat;

  @ApiPropertyOptional({ description: 'Total rounds for Swiss format (default auto-calculated: ceil(log2(N)))' })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(15)
  totalRounds?: number;

  @ApiPropertyOptional({ description: 'Round duration in seconds for BullMQ timeout triggers', default: 1800 })
  @IsNumber()
  @IsOptional()
  roundDurationSeconds?: number;

  @ApiProperty({ type: [CreateTournamentParticipantDto] })
  @IsArray()
  participants: CreateTournamentParticipantDto[];
}

export class ReportMatchResultDto {
  @ApiProperty({ description: 'Winner user ID (or null for a draw in Swiss)' })
  @IsString()
  @IsOptional()
  winnerId?: string;

  @ApiPropertyOptional({ description: 'Whether the match was a draw (Swiss only)', default: false })
  @IsOptional()
  isDraw?: boolean;

  @ApiPropertyOptional({ description: 'Score of Player 1' })
  @IsNumber()
  @IsOptional()
  player1Score?: number;

  @ApiPropertyOptional({ description: 'Score of Player 2' })
  @IsNumber()
  @IsOptional()
  player2Score?: number;
}

export class ForfeitMatchDto {
  @ApiProperty({ description: 'User ID of the forfeiting participant' })
  @IsString()
  @IsNotEmpty()
  forfeitedByUserId: string;

  @ApiPropertyOptional({ description: 'Reason for forfeit' })
  @IsString()
  @IsOptional()
  reason?: string;
}
