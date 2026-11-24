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

export class AuthorProblemSubmissionDto {
  @ApiProperty({ description: 'Title of the battle challenge' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Problem description including constraints and examples' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ enum: Difficulty, required: false })
  @IsEnum(Difficulty)
  @IsOptional()
  difficulty?: Difficulty;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ description: 'Community reference solution in TypeScript/JavaScript' })
  @IsString()
  @IsNotEmpty()
  referenceSolution: string;

  @ApiProperty({ required: false, description: 'Optional custom test generator function script' })
  @IsString()
  @IsOptional()
  testGeneratorScript?: string;

  @ApiProperty({ required: false, description: 'Optional validation schema and property constraints' })
  @IsOptional()
  validationSchema?: any;

  @ApiProperty({ description: 'User ID of the author submitting the problem' })
  @IsString()
  @IsNotEmpty()
  authorId: string;

  @ApiProperty({ required: false, description: 'Initial XP award for the challenge' })
  @IsOptional()
  initialXpReward?: number;
}

export class FuzzPreviewDto {
  @ApiProperty({ description: 'Reference solution in TypeScript/JavaScript' })
  @IsString()
  @IsNotEmpty()
  referenceSolution: string;

  @ApiProperty({ required: false, description: 'Optional validation schema' })
  @IsOptional()
  validationSchema?: any;

  @ApiProperty({ required: false, description: 'Optional custom generator script' })
  @IsString()
  @IsOptional()
  testGeneratorScript?: string;

  @ApiProperty({ required: false, description: 'Number of fuzzing cases to execute (default 100)' })
  @IsOptional()
  count?: number;
}

export class AwardAuthorRoyaltyDto {
  @ApiProperty({ description: 'Battle ID where the challenge was played' })
  @IsString()
  @IsNotEmpty()
  battleId: string;

  @ApiProperty({ required: false, description: 'Custom royalty XP amount (default 50)' })
  @IsOptional()
  royaltyAmount?: number;
}

