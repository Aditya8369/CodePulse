import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ArchRuleMode = 'FORBID_IMPORT' | 'ALLOW_ONLY_TARGETS';

export class ArchitecturalRuleDto {
  @ApiProperty({ example: 'RULE-CTRL-SVC' })
  id: string;

  @ApiProperty({ example: 'Controllers may only import Services or DTOs' })
  description: string;

  @ApiProperty({ example: '\\.controller\\.ts$' })
  fromPattern: string;

  @ApiProperty({ example: '\\.(repository|prisma)\\.ts$' })
  targetPattern: string;

  @ApiPropertyOptional({ enum: ['FORBID_IMPORT', 'ALLOW_ONLY_TARGETS'], default: 'FORBID_IMPORT' })
  mode?: ArchRuleMode;
}

export class SourceFileNodeDto {
  @ApiProperty({ example: 'src/modules/users/users.controller.ts' })
  filePath: string;

  @ApiProperty({ example: "import { PrismaService } from '../../prisma/prisma.service';" })
  content: string;
}

export class AnalyzeArchitectureDto {
  @ApiProperty({ type: [SourceFileNodeDto] })
  files: SourceFileNodeDto[];

  @ApiPropertyOptional({ type: [ArchitecturalRuleDto] })
  rules?: ArchitecturalRuleDto[];
}

export class PrArchitecturalCheckDto {
  @ApiProperty({ type: [SourceFileNodeDto] })
  baseFiles: SourceFileNodeDto[];

  @ApiProperty({ type: [SourceFileNodeDto] })
  headFiles: SourceFileNodeDto[];

  @ApiPropertyOptional({ type: [ArchitecturalRuleDto] })
  rules?: ArchitecturalRuleDto[];
}

export interface BoundaryViolationFinding {
  ruleId: string;
  description: string;
  sourceFile: string;
  targetFile: string;
  importSpecifier: string;
  lineNumber: number;
}

export interface CircularCycleFinding {
  cycleId: string;
  path: string[];
  length: number;
}

export interface ArchitecturalDriftReport {
  totalFiles: number;
  totalInternalEdges: number;
  executionTimeMs: number;
  driftIndexPercent: number; // 0..100
  circularCycles: CircularCycleFinding[];
  boundaryViolations: BoundaryViolationFinding[];
  mermaidGraph: string;
}

export interface PrArchitecturalGateResult {
  passed: boolean;
  blocked: boolean;
  baselineDriftIndexPercent: number;
  headDriftIndexPercent: number;
  driftDeltaPercent: number;
  newCircularCycles: CircularCycleFinding[];
  newBoundaryViolations: BoundaryViolationFinding[];
  summary: string;
  mermaidGraph: string;
}
