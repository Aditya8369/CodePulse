import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ChaosFaultType {
  LATENCY_INJECTION = 'LATENCY_INJECTION', // tc netem network delay
  MEMORY_PRESSURE = 'MEMORY_PRESSURE', // V8 heap / buffer allocation spikes
  REDIS_DISCONNECT = 'REDIS_DISCONNECT', // Cache / queue cluster split
  DB_CONNECTION_STARVATION = 'DB_CONNECTION_STARVATION', // Pool exhaustion simulation
}

export enum TargetEnvironment {
  STAGING = 'staging',
  SANDBOX = 'sandbox',
  TENANT_ISOLATED = 'tenant-isolated',
  PRODUCTION_ISOLATED = 'production-isolated',
  PRODUCTION = 'production',
}

export class RunChaosExperimentDto {
  @ApiProperty({
    enum: ChaosFaultType,
    description: 'Type of controlled fault injection to execute',
    example: ChaosFaultType.LATENCY_INJECTION,
  })
  @IsEnum(ChaosFaultType)
  faultType!: ChaosFaultType;

  @ApiPropertyOptional({
    description: 'Target environment or tenant cluster for blast radius containment',
    default: TargetEnvironment.SANDBOX,
    enum: TargetEnvironment,
  })
  @IsOptional()
  @IsEnum(TargetEnvironment)
  targetEnvironment?: TargetEnvironment = TargetEnvironment.SANDBOX;

  @ApiPropertyOptional({
    description: 'Target cluster identifier',
    example: 'sandbox-cluster-1',
  })
  @IsOptional()
  @IsString()
  targetCluster?: string;

  @ApiPropertyOptional({
    description: 'Optional isolated tenant ID for bounded blast radius',
    example: 'sandbox-tenant-alpha',
  })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({
    description: 'Optional mock error rate percentage for test validation',
    example: 1.5,
  })
  @IsOptional()
  @IsNumber()
  mockErrorRatePercent?: number;

  @ApiPropertyOptional({
    description: 'Maximum experiment duration in seconds before automatic rollback (max 60s)',
    default: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(60)
  durationSeconds?: number = 30;

  @ApiPropertyOptional({
    description: 'Simulated network latency in milliseconds (for LATENCY_INJECTION)',
    default: 250,
  })
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(2000)
  injectedLatencyMs?: number = 250;

  @ApiPropertyOptional({
    description: 'Simulated memory allocation size in MB (for MEMORY_PRESSURE)',
    default: 128,
  })
  @IsOptional()
  @IsNumber()
  @Min(32)
  @Max(512)
  memoryPressureMb?: number = 128;

  @ApiPropertyOptional({
    description: 'Emergency stop circuit-breaker error rate threshold percentage (default 5.0%)',
    default: 5.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(1.0)
  @Max(10.0)
  abortErrorRateThreshold?: number = 5.0;
}
