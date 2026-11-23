import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, IsEnum, IsOptional } from 'class-validator';
import { ChallengeType, Difficulty } from '@prisma/client';

export class CreateChallengeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ enum: ChallengeType })
  @IsEnum(ChallengeType)
  type: ChallengeType;

  @ApiProperty({ enum: Difficulty })
  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @ApiProperty()
  @IsInt()
  xpReward: number;

  @ApiProperty()
  @IsInt()
  target: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  expiresAt: string;
}

export class RecordChallengeSubmissionDto {
  @ApiProperty({ description: 'ID of the player submitting the solution' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Whether the challenge submission passed all test cases' })
  passed: boolean;

  @ApiProperty({ required: false, description: 'Optional player Elo/Glicko rating' })
  @IsOptional()
  playerRating?: number;

  @ApiProperty({ required: false, description: 'Optional player rating deviation' })
  @IsOptional()
  playerRd?: number;

  @ApiProperty({ required: false, description: 'Optional partial test score between 0.0 and 1.0' })
  @IsOptional()
  partialScore?: number;

  @ApiProperty({ required: false, description: 'Optional battle ID associated with submission' })
  @IsString()
  @IsOptional()
  battleId?: string;
}

export class CalibrateChallengeBatchDto {
  @ApiProperty({ required: false, description: 'Optional challenge ID to calibrate; omit to calibrate all' })
  @IsString()
  @IsOptional()
  challengeId?: string;
}
