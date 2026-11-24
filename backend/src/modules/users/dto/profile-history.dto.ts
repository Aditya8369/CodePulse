import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  IsDateString,
  IsInt,
} from 'class-validator';
import { Tier } from '@prisma/client';

export class RecordProfileMutationDto {
  @ApiProperty({ description: 'ID of the user' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({ description: 'Competitive Elo / rating score' })
  @IsNumber()
  @IsOptional()
  eloRating?: number;

  @ApiPropertyOptional({ enum: Tier, description: 'Developer tier' })
  @IsEnum(Tier)
  @IsOptional()
  tier?: Tier;

  @ApiPropertyOptional({ description: 'List of top programming languages', type: [String] })
  @IsArray()
  @IsOptional()
  topLanguages?: string[];

  @ApiPropertyOptional({ description: 'Developer bio summary' })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiPropertyOptional({ description: 'Developer level' })
  @IsInt()
  @IsOptional()
  level?: number;

  @ApiPropertyOptional({ description: 'Total developer XP' })
  @IsInt()
  @IsOptional()
  xp?: number;

  @ApiPropertyOptional({
    description: 'Valid-time beginning (effective real-world date). Defaults to current time if omitted.',
  })
  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @ApiPropertyOptional({
    description: 'Valid-time end date. Defaults to far future (9999-12-31) for active slices.',
  })
  @IsDateString()
  @IsOptional()
  validTo?: string;

  @ApiPropertyOptional({
    description: 'System-time when fact was recorded (defaults to now)',
  })
  @IsDateString()
  @IsOptional()
  recordedAt?: string;
}

export class GetProfileHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Valid-time query point (ISO-8601 string, e.g. 2026-06-01T00:00:00Z). Defaults to current time.',
  })
  @IsDateString()
  @IsOptional()
  at?: string;

  @ApiPropertyOptional({
    description: 'System-time (asOf transaction time query point) for true bi-temporal state exploration.',
  })
  @IsDateString()
  @IsOptional()
  asOf?: string;

  @ApiPropertyOptional({
    description: 'Whether to return the complete chronological validity timeline of slices.',
  })
  @IsOptional()
  timeline?: string;
}

export class HistoricalProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  username?: string;

  @ApiProperty()
  eloRating: number;

  @ApiProperty({ enum: Tier })
  tier: Tier;

  @ApiProperty({ type: [String] })
  topLanguages: string[];

  @ApiPropertyOptional()
  bio?: string | null;

  @ApiPropertyOptional()
  level?: number;

  @ApiPropertyOptional()
  xp?: number;

  @ApiProperty({ description: 'Start of real-world valid interval' })
  validFrom: Date;

  @ApiProperty({ description: 'End of real-world valid interval' })
  validTo: Date;

  @ApiProperty({ description: 'System-time when fact was recorded into database' })
  recordedAt: Date;

  @ApiPropertyOptional({ description: 'System-time when fact was superseded/replaced (null if active)' })
  supersededAt?: Date | null;
}
