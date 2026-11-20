import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min, Max, IsArray } from 'class-validator';

export type WasmSupportedLanguage = 'c' | 'rust' | 'go' | 'wat' | 'wasm';

export class WasmExecuteDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsEnum(['c', 'rust', 'go', 'wat', 'wasm'])
  language?: WasmSupportedLanguage = 'wat';

  @IsOptional()
  @IsString()
  stdin?: string = '';

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(1_000_000_000)
  fuelLimit?: number = 100_000_000;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(256) // 256 pages = 16 MB max
  memoryLimitPages?: number = 16;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(10000)
  timeoutMs?: number = 2000;

  @IsOptional()
  @IsArray()
  args?: string[] = [];
}

export interface WasmExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  fuelConsumed: number;
  fuelLimit: number;
  executionTimeMs: number;
  startupTimeMs: number;
  memoryPeakBytes: number;
  memoryPages: number;
  killedByFuelLimit: boolean;
  killedByTimeout: boolean;
  memoryTrapped: boolean;
  error?: string;
}

