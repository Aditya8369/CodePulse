import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum AlgorithmicComplexityClass {
  O_1 = 'O(1)',
  O_LOG_N = 'O(log N)',
  O_N = 'O(N)',
  O_N_LOG_N = 'O(N log N)',
  O_N_SQUARED = 'O(N^2)',
  O_EXPONENTIAL = 'O(2^N)',
}

export class MatchResultTelemetryDto {
  @IsString()
  battleId!: string;

  @IsString()
  userId!: string;

  @IsNumber()
  @Min(1)
  timeToFirstSubmitSec!: number;

  @IsNumber()
  @Min(0)
  @Max(300)
  typingSpeedWpm!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  cyclomaticEfficiency!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  firstAttemptPassRate!: number;

  @IsEnum(AlgorithmicComplexityClass)
  selectedComplexity!: AlgorithmicComplexityClass;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  placementMatchNumber?: number;
}
