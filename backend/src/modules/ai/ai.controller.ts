import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TranspilerService } from './transpiler.service';
import { PrAnalyzerService, PrAnalysisResult } from './pr-analyzer.service';
import {
  CodeReviewerService,
  CommitReviewSummary,
  FindingStatus,
} from './code-reviewer.service';
import { ReviewCommitRequestDto } from './dto/review-commit.dto';
import {
  TranspileRequestDto,
  TranspileResponseDto,
  SupportedLanguage,
} from './dto/transpiler.dto';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(
    private readonly transpilerService: TranspilerService,
    private readonly prAnalyzer: PrAnalyzerService,
    private readonly codeReviewer: CodeReviewerService,
  ) {}

  @Post('transpile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Automated polyglot code transpiler & idiomatic language migration engine',
    description:
      'Transpiles algorithms across TypeScript, Python, Go, and Rust while preserving target language idioms, generating starter code stubs, and verifying output equivalence against reference tests.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully transpiled and verified polyglot code',
    type: TranspileResponseDto,
  })
  async transpileCode(@Body() dto: TranspileRequestDto): Promise<TranspileResponseDto> {
    if (!dto.sourceCode || !dto.sourceLanguage || !dto.targetLanguage) {
      throw new BadRequestException('sourceCode, sourceLanguage, and targetLanguage are required');
    }
    return this.transpilerService.transpile(dto);
  }

  @Post('analyze-pr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI pull request quality, convention, and test coverage analyzer' })
  async analyzePr(@Body() prDetails: any): Promise<PrAnalysisResult> {
    return this.prAnalyzer.analyzePullRequest(prDetails);
  }

  @Post('review-commit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AST-Based Automated Code Review & Security Vulnerability Advisor',
    description:
      'Performs AST static security analysis on repository commits for OWASP Top 10 vulnerabilities (SQLi, XSS, ReDoS, insecure crypto, hardcoded secrets) and generates inline annotations with fix suggestions.',
  })
  async reviewCommit(@Body() dto: ReviewCommitRequestDto): Promise<CommitReviewSummary> {
    if (!dto.commitSha) {
      throw new BadRequestException('commitSha is required');
    }
    return this.codeReviewer.reviewCommit(dto);
  }

  @Get('findings/:commitSha')
  @ApiOperation({ summary: 'Get code review security findings for a specific commit' })
  async getCommitFindings(@Param('commitSha') commitSha: string) {
    return this.codeReviewer.getFindingsForCommit(commitSha);
  }

  @Patch('findings/:id/status')
  @ApiOperation({ summary: 'Update resolution status of a code review security finding' })
  async updateFindingStatus(
    @Param('id') id: string,
    @Body() body: { status: FindingStatus },
  ) {
    if (!body.status) {
      throw new BadRequestException('status is required (OPEN, RESOLVED, IGNORED)');
    }
    return this.codeReviewer.updateFindingStatus(id, body.status);
  }
}

