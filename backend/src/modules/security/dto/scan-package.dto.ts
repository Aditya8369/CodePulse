import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum RiskSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum Ecosystem {
  NPM = 'npm',
  PYPI = 'pypi',
}

export class PackageDependencyItemDto {
  @ApiProperty({
    description: 'Name of the package dependency',
    example: 'lodahs',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Version or semantic version range',
    example: '^4.17.21',
  })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({
    description: 'Target package ecosystem (npm or pypi)',
    enum: Ecosystem,
    default: Ecosystem.NPM,
  })
  @IsOptional()
  @IsEnum(Ecosystem)
  ecosystem?: Ecosystem;
}

export class ScanPackageDto {
  @ApiProperty({
    description: 'List of package dependencies to scan for typosquatting and confusion attacks',
    type: [PackageDependencyItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackageDependencyItemDto)
  dependencies: PackageDependencyItemDto[];

  @ApiPropertyOptional({
    description: 'Custom internal organization prefixes to protect (default: ["@codepulse", "@codepulse/"])',
    type: [String],
    example: ['@codepulse', '@codepulse/'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  protectedNamespaces?: string[];
}

export class ScanSinglePackageDto {
  @ApiProperty({
    description: 'Package name to scan',
    example: 'lodahs',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Package ecosystem (npm or pypi)',
    enum: Ecosystem,
    default: Ecosystem.NPM,
  })
  @IsOptional()
  @IsEnum(Ecosystem)
  ecosystem?: Ecosystem;

  @ApiPropertyOptional({
    description: 'Version of the package',
    example: '1.0.0',
  })
  @IsOptional()
  @IsString()
  version?: string;
}

export interface TypoSquatFinding {
  packageName: string;
  ecosystem: Ecosystem;
  targetCandidate?: string;
  levenshteinDistance?: number;
  damerauDistance?: number;
  isHomoglyphAttack: boolean;
  normalizedName?: string;
  isPrivateNamespaceViolation: boolean;
  isLowReputationPackage: boolean;
  packageAgeDays?: number;
  downloadsWeekly?: number;
  maintainersCount?: number;
  reasons: string[];
  severity: RiskSeverity;
  blockInstall: boolean;
}

export class ScanResultDto {
  @ApiProperty({
    description: 'Overall risk severity of the scan batch',
    enum: RiskSeverity,
  })
  overallSeverity: RiskSeverity;

  @ApiProperty({
    description: 'Whether any automated runner installation must be blocked',
  })
  blockRunnerInstall: boolean;

  @ApiProperty({
    description: 'Detailed findings for each scanned dependency',
  })
  findings: TypoSquatFinding[];

  @ApiProperty({
    description: 'Total number of dependencies scanned',
  })
  scannedCount: number;

  @ApiProperty({
    description: 'Number of flagged suspicious packages',
  })
  flaggedCount: number;
}
