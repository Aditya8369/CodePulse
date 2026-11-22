import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PersonaDifficultyTier {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  EXPERT = 'EXPERT',
  LEGENDARY = 'LEGENDARY',
}

export class AiPersonaDto {
  @ApiProperty({ description: 'Persona unique identifier', example: 'lovelace' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Historical programmer persona name', example: 'Ada Lovelace' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Avatar illustration URL', example: 'https://avatars.githubusercontent.com/u/ada-lovelace' })
  @IsString()
  avatarUrl: string;

  @ApiProperty({ description: 'Competitive Elo rating calibration', example: 2150 })
  @IsNumber()
  eloRating: number;

  @ApiProperty({ description: 'Preferred programming language', example: 'typescript' })
  @IsString()
  preferredLanguage: string;

  @ApiProperty({ description: 'Typing speed in words per minute (WPM)', example: 70 })
  @IsNumber()
  typingSpeedWpm: number;

  @ApiProperty({ description: 'System prompt directing the persona coding behavior' })
  @IsString()
  systemPrompt: string;

  @ApiProperty({ description: 'Difficulty tier', enum: PersonaDifficultyTier, example: PersonaDifficultyTier.LEGENDARY })
  @IsString()
  difficultyTier: string;

  @ApiProperty({ description: 'Signature coding style description', example: 'Optimal recursive algorithms & analytical purity' })
  @IsString()
  codingStyle: string;

  @ApiPropertyOptional({ description: 'Persona memorable quote or tagline', example: 'The Analytical Engine weaves algebraic patterns.' })
  @IsString()
  @IsOptional()
  tagline?: string;
}

export class ChallengeSummaryDto {
  @ApiProperty({ description: 'Problem UUID', example: 'chal-fib-matrix' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Challenge title', example: 'Logarithmic Matrix Fibonacci' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Problem statement and requirements' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Language starter template stub' })
  @IsString()
  starterCode: string;

  @ApiProperty({ description: 'Total automated unit test cases', example: 8 })
  @IsNumber()
  testCasesCount: number;
}

export class StartPracticeBattleRequestDto {
  @ApiProperty({ description: 'Challenger user ID', example: 'user-uuid-1' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({
    description: 'Specific persona to challenge (lovelace, turing, carmack, hamilton). If omitted, matches automatically by Elo.',
    example: 'carmack',
  })
  @IsString()
  @IsOptional()
  personaId?: string;

  @ApiPropertyOptional({ description: 'Challenge problem ID. If omitted, picks a balanced algorithmic challenge.' })
  @IsString()
  @IsOptional()
  challengeId?: string;

  @ApiPropertyOptional({ description: 'Preferred language', example: 'typescript' })
  @IsString()
  @IsOptional()
  preferredLanguage?: string;
}

export class PracticeBattleResponseDto {
  @ApiProperty({ description: 'Battle session UUID' })
  battleId: string;

  @ApiProperty({ description: 'Matched historical AI persona details', type: () => AiPersonaDto })
  @ValidateNested()
  @Type(() => AiPersonaDto)
  persona: AiPersonaDto;

  @ApiProperty({ description: 'Challenge details', type: () => ChallengeSummaryDto })
  @ValidateNested()
  @Type(() => ChallengeSummaryDto)
  challenge: ChallengeSummaryDto;

  @ApiProperty({ description: 'Battle status', example: 'ACTIVE' })
  status: string;

  @ApiProperty({ description: 'Match initiation timestamp' })
  createdAt: string;
}

export class PersonaKeystrokeFrameDto {
  @ApiProperty({ description: 'Character or token delta typed in this frame', example: 'f' })
  delta: string;

  @ApiProperty({ description: 'Cursor index offset in editor', example: 24 })
  cursorPosition: number;

  @ApiProperty({ description: 'Simulated human micro-delay before next stroke in milliseconds (150ms-400ms)', example: 220 })
  delayMs: number;

  @ApiPropertyOptional({ description: 'Whether this stroke represents a simulated realistic typo and backspace correction', example: false })
  isTypoCorrection?: boolean;

  @ApiProperty({ description: 'Cumulative code state after this frame' })
  codeSnapshot: string;
}

export class SimulateKeystrokesRequestDto {
  @ApiProperty({ description: 'Persona identifier', example: 'carmack' })
  @IsString()
  @IsNotEmpty()
  personaId: string;

  @ApiPropertyOptional({ description: 'Custom solution text to stream. If omitted, uses persona signature reference solution.' })
  @IsString()
  @IsOptional()
  targetCode?: string;

  @ApiPropertyOptional({ description: 'Number of frames to generate', default: 50 })
  @IsNumber()
  @IsOptional()
  frameCount?: number;
}

export class FinishPracticeMatchDto {
  @ApiProperty({ description: 'Battle session UUID' })
  @IsString()
  @IsNotEmpty()
  battleId: string;

  @ApiProperty({ description: 'Player user ID' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Player solution code' })
  @IsString()
  userCode: string;

  @ApiProperty({ description: 'Number of tests passed by user', example: 8 })
  @IsNumber()
  userPassedTests: number;

  @ApiProperty({ description: 'Total challenge tests', example: 8 })
  @IsNumber()
  totalTests: number;

  @ApiPropertyOptional({ description: 'Execution time in milliseconds', example: 45 })
  @IsNumber()
  @IsOptional()
  executionTimeMs?: number;
}

export class FinishPracticeMatchResponseDto {
  @ApiProperty({ description: 'Battle session UUID' })
  battleId: string;

  @ApiProperty({ description: 'Match outcome', enum: ['USER', 'PERSONA', 'DRAW'], example: 'USER' })
  winner: 'USER' | 'PERSONA' | 'DRAW';

  @ApiProperty({ description: 'Player final score', example: 100 })
  userScore: number;

  @ApiProperty({ description: 'AI persona final score', example: 85 })
  personaScore: number;

  @ApiProperty({ description: 'Unranked practice XP awarded to player (practice matches do not affect competitive Elo)', example: 50 })
  practiceXpAwarded: number;

  @ApiProperty({ description: 'Match post-game summary and commentary' })
  summary: string;
}
