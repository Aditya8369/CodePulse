import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class HalsteadMetricsDto {
  @ApiProperty({ description: 'Number of distinct operators (eta1)', example: 14 })
  @IsNumber()
  distinctOperators: number;

  @ApiProperty({ description: 'Number of distinct operands (eta2)', example: 22 })
  @IsNumber()
  distinctOperands: number;

  @ApiProperty({ description: 'Total number of operators (N1)', example: 48 })
  @IsNumber()
  totalOperators: number;

  @ApiProperty({ description: 'Total number of operands (N2)', example: 64 })
  @IsNumber()
  totalOperands: number;

  @ApiProperty({ description: 'Program vocabulary (eta = eta1 + eta2)', example: 36 })
  @IsNumber()
  programVocabulary: number;

  @ApiProperty({ description: 'Program length (N = N1 + N2)', example: 112 })
  @IsNumber()
  programLength: number;

  @ApiProperty({ description: 'Halstead Volume (V = N * log2(eta))', example: 579.03 })
  @IsNumber()
  volume: number;

  @ApiProperty({ description: 'Halstead Difficulty (D = (eta1 / 2) * (N2 / eta2))', example: 20.36 })
  @IsNumber()
  difficulty: number;

  @ApiProperty({ description: 'Halstead Effort (E = D * V)', example: 11789.05 })
  @IsNumber()
  effort: number;

  @ApiProperty({ description: 'Estimated time to program in seconds (T = E / 18)', example: 654.95 })
  @IsNumber()
  time: number;

  @ApiProperty({ description: 'Estimated delivered bugs (B = V / 3000)', example: 0.19 })
  @IsNumber()
  bugs: number;
}

export class FunctionComplexityDto {
  @ApiProperty({ description: 'Function or method identifier', example: 'processBattleMatch' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Starting line number (1-based)', example: 42 })
  @IsNumber()
  startLine: number;

  @ApiProperty({ description: 'Ending line number (1-based)', example: 120 })
  @IsNumber()
  endLine: number;

  @ApiProperty({ description: 'Cyclomatic Complexity score (M = E - N + 2P)', example: 18 })
  @IsNumber()
  cyclomaticComplexity: number;

  @ApiProperty({ description: 'Halstead metrics for this function scope', type: () => HalsteadMetricsDto })
  @ValidateNested()
  @Type(() => HalsteadMetricsDto)
  halstead: HalsteadMetricsDto;

  @ApiProperty({ description: 'Source lines of code in function', example: 78 })
  @IsNumber()
  linesOfCode: number;

  @ApiProperty({ description: 'Maintainability Index score (0 to 100)', example: 52.4 })
  @IsNumber()
  maintainabilityIndex: number;

  @ApiProperty({ description: 'Cognitive risk classification', enum: ['LOW', 'MEDIUM', 'HIGH'], example: 'HIGH' })
  @IsString()
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';

  @ApiProperty({ description: 'Whether function exceeds threshold (Complexity > 15 or MI < 65)', example: true })
  @IsBoolean()
  isRefactoringCandidate: boolean;

  @ApiProperty({
    description: 'Actionable refactoring recommendations to reduce complexity',
    example: [
      'Extract Method: Decompose monolithic function with Cyclomatic Complexity of 18 into atomic helpers.',
      'Guard Clauses: Replace deeply nested conditionals with early returns.',
    ],
    type: [String],
  })
  @IsArray()
  refactoringSuggestions: string[];
}

export class FileComplexityDto {
  @ApiProperty({ description: 'Relative file path in repository', example: 'src/modules/battles/battles.service.ts' })
  @IsString()
  filePath: string;

  @ApiProperty({ description: 'Programming language of the file', example: 'typescript' })
  @IsString()
  language: string;

  @ApiProperty({ description: 'Total physical lines in file', example: 340 })
  @IsNumber()
  totalLines: number;

  @ApiProperty({ description: 'Executable source lines of code excluding empty/comments', example: 265 })
  @IsNumber()
  sourceLinesOfCode: number;

  @ApiProperty({ description: 'Aggregate file Cyclomatic Complexity', example: 24 })
  @IsNumber()
  cyclomaticComplexity: number;

  @ApiProperty({ description: 'Aggregate Halstead metrics', type: () => HalsteadMetricsDto })
  @ValidateNested()
  @Type(() => HalsteadMetricsDto)
  halstead: HalsteadMetricsDto;

  @ApiProperty({ description: 'Aggregate Maintainability Index score (0 to 100)', example: 68.2 })
  @IsNumber()
  maintainabilityIndex: number;

  @ApiProperty({ description: 'Aggregate file risk level', enum: ['LOW', 'MEDIUM', 'HIGH'], example: 'MEDIUM' })
  @IsString()
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';

  @ApiProperty({ description: 'Parsed functions in the file', type: [FunctionComplexityDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FunctionComplexityDto)
  functions: FunctionComplexityDto[];

  @ApiProperty({ description: 'High-risk functions flagged as refactoring candidates', type: [FunctionComplexityDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FunctionComplexityDto)
  highRiskFunctions: FunctionComplexityDto[];
}

export class CodeAnalysisRequestDto {
  @ApiProperty({
    description: 'Raw source code snippet to analyze',
    example: 'function calculateTax(income: number) { if (income > 100000) return income * 0.3; return income * 0.15; }',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({
    description: 'Programming language (typescript, javascript, python)',
    example: 'typescript',
    default: 'typescript',
  })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({
    description: 'Optional file path for contextual reporting',
    example: 'src/tax.ts',
    default: 'snippet.ts',
  })
  @IsString()
  @IsOptional()
  filePath?: string;
}

export class BatchFileInputDto {
  @ApiProperty({ description: 'Path to source file', example: 'src/index.ts' })
  @IsString()
  @IsNotEmpty()
  filePath: string;

  @ApiProperty({ description: 'Source code content' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Language override', example: 'typescript' })
  @IsString()
  @IsOptional()
  language?: string;
}

export class BatchFilesAnalysisRequestDto {
  @ApiProperty({ description: 'Array of files to analyze', type: [BatchFileInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchFileInputDto)
  files: BatchFileInputDto[];
}

export class CreateComplexitySnapshotRequestDto {
  @ApiPropertyOptional({ description: 'Branch name', default: 'main' })
  @IsString()
  @IsOptional()
  branch?: string;

  @ApiPropertyOptional({ description: 'Commit SHA' })
  @IsString()
  @IsOptional()
  commitSha?: string;

  @ApiPropertyOptional({
    description: 'Array of repository files to analyze and snapshot',
    type: [BatchFileInputDto],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => BatchFileInputDto)
  files?: BatchFileInputDto[];
}

export class RepositoryComplexitySnapshotDto {
  @ApiPropertyOptional({ description: 'Snapshot unique identifier' })
  id?: string;

  @ApiProperty({ description: 'Repository ID in database' })
  repositoryId: string;

  @ApiProperty({ description: 'Full repository name (owner/name)' })
  repositoryFullName: string;

  @ApiProperty({ description: 'Branch name', default: 'main' })
  branch: string;

  @ApiPropertyOptional({ description: 'Commit SHA' })
  commitSha?: string;

  @ApiProperty({ description: 'Total analyzed files count' })
  fileCount: number;

  @ApiProperty({ description: 'Total source lines of code' })
  totalLoc: number;

  @ApiProperty({ description: 'Average Cyclomatic Complexity across files' })
  averageComplexity: number;

  @ApiProperty({ description: 'Maximum Cyclomatic Complexity observed in any function' })
  maxComplexity: number;

  @ApiProperty({ description: 'Average Maintainability Index (0-100)' })
  averageMaintainability: number;

  @ApiProperty({ description: 'Summed Halstead Volume' })
  totalHalsteadVolume: number;

  @ApiProperty({ description: 'Count of functions flagged with Complexity > 15 or MI < 65' })
  highRiskFunctionsCount: number;

  @ApiProperty({ description: 'Detailed per-file metrics', type: [FileComplexityDto] })
  fileMetrics: FileComplexityDto[];

  @ApiProperty({ description: 'List of all high-risk function hotspots with refactoring advice', type: [FunctionComplexityDto] })
  highRiskFunctions: FunctionComplexityDto[];

  @ApiPropertyOptional({ description: 'Snapshot creation timestamp' })
  createdAt?: string;
}
