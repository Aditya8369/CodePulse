import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateMentorshipProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isMentor?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isApprentice?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetSkills?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class MatchPairingDto {
  @ApiPropertyOptional({ description: 'Specific skill goal filter' })
  @IsOptional()
  @IsString()
  skill?: string;

  @ApiPropertyOptional({ description: 'Preferred timezone filter (e.g. UTC, America/New_York)' })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class CreateShadowSessionDto {
  @ApiProperty({ description: 'User ID of the mentor' })
  @IsString()
  @IsNotEmpty()
  mentorId: string;

  @ApiProperty({ description: 'Session title or objective' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class HandoverDriverSeatDto {
  @ApiProperty({ enum: ['MENTOR', 'APPRENTICE'] })
  @IsEnum(['MENTOR', 'APPRENTICE'])
  driverSeat: 'MENTOR' | 'APPRENTICE';
}

export class ViewportSyncDto {
  @ApiProperty()
  @IsString()
  activeFile: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  activeLine: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  activeColumn: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  viewportTopLine: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scratchpadNotes?: string;
}
