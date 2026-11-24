import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum BenchmarkScenarioType {
  RAMP_AND_SPIKE = 'ramp_and_spike',
  STRESS = 'stress',
  SOAK = 'soak',
  SMOKE = 'smoke',
}

export class BenchmarkThresholdsDto {
  @ApiProperty({ description: 'P95 latency threshold in milliseconds', default: 200 })
  @IsNumber()
  @Min(1)
  p95LatencyMs: number = 200;

  @ApiProperty({ description: 'Maximum tolerable error rate (0.0 to 1.0)', default: 0.01 })
  @IsNumber()
  @Min(0)
  @Max(1)
  maxErrorRate: number = 0.01;
}

export class GenerateBenchmarkRequestDto {
  @ApiProperty({
    description: 'OpenAPI 3.0 / Swagger JSON specification object or string',
    example: {
      openapi: '3.0.0',
      info: { title: 'CodePulse API', version: '1.0' },
      paths: {
        '/api/v1/battles': {
          post: {
            summary: 'Create battle',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      language: { type: 'string' },
                      maxParticipants: { type: 'integer', minimum: 2 },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @IsNotEmpty()
  openApiSpec!: Record<string, any> | string;

  @ApiPropertyOptional({
    description: 'Specific endpoint paths to target (defaults to all paths in spec)',
    type: [String],
    example: ['/api/v1/battles', '/api/v1/leaderboard'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetEndpoints?: string[];

  @ApiPropertyOptional({ description: 'Target steady-state Virtual Users (VUs)', default: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5000)
  vus?: number = 50;

  @ApiPropertyOptional({ description: 'Steady-state duration in seconds', default: 60 })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(3600)
  durationSeconds?: number = 60;

  @ApiPropertyOptional({ description: 'Ramp-up duration in seconds', default: 15 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(600)
  rampUpSeconds?: number = 15;

  @ApiPropertyOptional({ description: 'Peak spike VUs', default: 150 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  spikeVus?: number = 150;

  @ApiPropertyOptional({ description: 'Base URL for API target', default: 'http://localhost:3000' })
  @IsOptional()
  @IsString()
  baseUrl?: string = 'http://localhost:3000';

  @ApiPropertyOptional({ enum: BenchmarkScenarioType, default: BenchmarkScenarioType.RAMP_AND_SPIKE })
  @IsOptional()
  @IsEnum(BenchmarkScenarioType)
  scenarioType?: BenchmarkScenarioType = BenchmarkScenarioType.RAMP_AND_SPIKE;

  @ApiPropertyOptional({ type: BenchmarkThresholdsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BenchmarkThresholdsDto)
  thresholds?: BenchmarkThresholdsDto;
}

export class BenchmarkStageDto {
  @ApiProperty({ example: '15s' })
  duration!: string;

  @ApiProperty({ example: 50 })
  target!: number;
}

export class GenerateBenchmarkResponseDto {
  @ApiProperty({ example: 'bm-f78a2c10' })
  benchmarkId!: string;

  @ApiProperty({ description: 'Executable k6 JavaScript test script' })
  k6Script!: string;

  @ApiProperty({ type: [String], example: ['/api/v1/battles', '/api/v1/leaderboard'] })
  endpointsCovered!: string[];

  @ApiProperty({ type: [BenchmarkStageDto] })
  stages!: BenchmarkStageDto[];

  @ApiProperty({ description: 'Generated synthetic mock payloads for requests' })
  syntheticPayloadExamples!: Record<string, any>;

  @ApiProperty({ example: 'k6 run script.js' })
  cliExecutionCommand!: string;
}

export class ExecuteBenchmarkRequestDto {
  @ApiProperty({ example: 'bm-f78a2c10' })
  @IsString()
  @IsNotEmpty()
  benchmarkId!: string;

  @ApiPropertyOptional({ description: 'Optional custom k6 script override' })
  @IsOptional()
  @IsString()
  k6Script?: string;

  @ApiPropertyOptional({ description: 'Dry run execution simulation without making live external HTTP calls', default: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean = true;
}

export class ThroughputDataPointDto {
  @ApiProperty({ example: 1 })
  second!: number;

  @ApiProperty({ example: 120 })
  rps!: number;

  @ApiProperty({ example: 45.2 })
  p95Ms!: number;

  @ApiProperty({ example: 0 })
  errors!: number;
}

export class BenchmarkExecutionResultDto {
  @ApiProperty({ example: 'bm-f78a2c10' })
  benchmarkId!: string;

  @ApiProperty({ example: 'COMPLETED' })
  status!: 'COMPLETED' | 'FAILED';

  @ApiProperty({ example: 7500 })
  totalRequests!: number;

  @ApiProperty({ example: 42.5 })
  p95LatencyMs!: number;

  @ApiProperty({ example: 88.1 })
  p99LatencyMs!: number;

  @ApiProperty({ example: 28.3 })
  avgLatencyMs!: number;

  @ApiProperty({ example: 0.002 })
  errorRate!: number;

  @ApiProperty({ example: 125 })
  requestsPerSecond!: number;

  @ApiProperty({ example: true })
  passedThresholds!: boolean;

  @ApiProperty({ type: [ThroughputDataPointDto] })
  throughputTimeline!: ThroughputDataPointDto[];
}

