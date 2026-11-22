import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export enum HintTier {
  TIER_1_CONCEPTUAL = 1,
  TIER_2_PSEUDOCODE = 2,
  TIER_3_EDGE_CASES = 3,
}

export class RequestHintDto {
  @ApiProperty({ description: 'ID of the active battle', example: 'battle-uuid-1234' })
  @IsString()
  @IsNotEmpty()
  battleId: string;

  @ApiProperty({ description: 'ID of the requesting player', example: 'user-uuid-5678' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Progressive hint tier: 1=Conceptual (10%), 2=Pseudocode (25%), 3=Edge-Cases (40%)',
    enum: [1, 2, 3],
    example: 1,
  })
  @IsInt()
  @Min(1)
  @Max(3)
  tier: number;

  @ApiPropertyOptional({ description: 'Algorithmic problem title', example: 'Two Sum II - Input Array Is Sorted' })
  @IsString()
  @IsOptional()
  problemTitle?: string;

  @ApiPropertyOptional({
    description: 'Problem description and constraints',
    example: 'Given a 1-indexed array of integers numbers that is already sorted in non-decreasing order...',
  })
  @IsString()
  @IsOptional()
  problemDescription?: string;

  @ApiPropertyOptional({
    description: 'Current player code draft under analysis',
    example: 'function twoSum(numbers: number[], target: number) { ... }',
  })
  @IsString()
  @IsOptional()
  currentCode?: string;

  @ApiPropertyOptional({ description: 'Programming language of the draft', example: 'typescript' })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({ description: 'Seconds elapsed since battle started', example: 360 })
  @IsInt()
  @IsOptional()
  elapsedSeconds?: number;

  @ApiPropertyOptional({ description: 'Total scheduled duration of match in seconds', example: 1200 })
  @IsInt()
  @IsOptional()
  totalMatchSeconds?: number;
}

export class HintResponseDto {
  @ApiProperty({ description: 'ID of the battle' })
  battleId: string;

  @ApiProperty({ description: 'ID of the player' })
  userId: string;

  @ApiProperty({ description: 'Hint tier number (1, 2, or 3)' })
  tier: number;

  @ApiProperty({ description: 'Human-readable tier title' })
  tierName: string;

  @ApiProperty({ description: 'Formatted markdown hint content' })
  hintMarkdown: string;

  @ApiProperty({ description: 'Nominal base penalty percentage for this tier (10%, 25%, 40%)' })
  basePenaltyPercent: number;

  @ApiProperty({ description: 'Effective time-decayed penalty percentage applied' })
  timeDecayedPenaltyPercent: number;

  @ApiProperty({ description: 'Estimated XP deducted from victory reward (based on 150 base victory XP)' })
  estimatedXpDeduction: number;

  @ApiPropertyOptional({ description: 'Estimated ELO rating penalty points deducted from victory' })
  estimatedEloPenalty?: number;

  @ApiProperty({ description: 'Mandatory cooldown before next hint request in seconds (120s)' })
  cooldownSeconds: number;

  @ApiProperty({ description: 'Earliest ISO timestamp when player can request the next hint' })
  nextAllowedAt: string;

  @ApiProperty({ description: 'Guardrail verification result ensuring zero solution leakage' })
  guardrailStatus: 'PASS' | 'FILTERED';
}

export interface HintUsageRecord {
  userId: string;
  tier: number;
  requestedAt: string;
  penaltyPercentage: number;
  hintSummary: string;
  eloPenaltyPoints?: number;
}

