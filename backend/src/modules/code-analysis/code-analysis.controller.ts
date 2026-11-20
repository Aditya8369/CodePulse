import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { AstScannerService } from './ast-scanner.service';
import type { FileQualityAnalysis } from './ast-scanner.service';

export interface ScanCodeDto {
  code: string;
  filePath?: string;
}

@Controller('code-analysis')
export class CodeAnalysisController {
  constructor(private readonly astScannerService: AstScannerService) {}

  @Post('scan')
  scanSnippet(@Body() body: ScanCodeDto): FileQualityAnalysis {
    return this.astScannerService.analyzeCode(body.code, body.filePath || 'snippet.ts');
  }

  @Get('repos/:id/quality-report')
  getRepoQualityReport(@Param('id') id: string) {
    return {
      repositoryId: id,
      totalFilesScanned: 24,
      avgCyclomaticComplexity: 4.2,
      maintainabilityIndex: 88,
      grade: 'A',
      codeSmellCount: 3,
      scannedAt: new Date(),
    };
  }
}
