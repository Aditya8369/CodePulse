import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  IsIn,
} from 'class-validator';

export class CodeSnippetDto {
  @ApiProperty({ description: 'Programming or markup language of the snippet', example: 'typescript' })
  @IsString()
  language: string;

  @ApiProperty({ description: 'Extracted source code snippet content' })
  @IsString()
  code: string;
}

export class TargetEndpointDto {
  @ApiProperty({ description: 'HTTP method inferred from report', example: 'POST' })
  @IsString()
  method: string;

  @ApiProperty({ description: 'Target path or URL route', example: '/api/v1/auth/login' })
  @IsString()
  path: string;

  @ApiPropertyOptional({ description: 'Full URL if provided in bug report' })
  @IsString()
  @IsOptional()
  url?: string;
}

export class BugReportParameters {
  @ApiProperty({
    description: 'Extracted discrete steps to reproduce the bug',
    type: [String],
    example: ['1. Navigate to /dashboard', '2. Submit form with empty title', '3. Observe 500 error'],
  })
  stepsToReproduce: string[];

  @ApiProperty({
    description: 'Expected system behavior as reported by user',
    example: 'Validation error response 400 with message "Title is required"',
  })
  expectedBehavior: string;

  @ApiProperty({
    description: 'Actual erroneous behavior or failure message observed',
    example: 'Unhandled 500 Internal Server Error: Cannot read property title of undefined',
  })
  actualBehavior: string;

  @ApiProperty({
    description: 'Extracted environment metadata (OS, browser, runtime, version)',
    example: { os: 'Ubuntu 22.04', node: 'v20.10.0', browser: 'Chrome 120' },
  })
  environment: Record<string, string>;

  @ApiProperty({
    description: 'Fenced code snippets found in issue description',
    type: [CodeSnippetDto],
  })
  codeSnippets: CodeSnippetDto[];

  @ApiProperty({
    description: 'Extracted stack traces or error logs',
    type: [String],
  })
  stackTraces: string[];

  @ApiProperty({
    description: 'Inferred API endpoints or URLs targeted by the issue',
    type: [TargetEndpointDto],
  })
  targetEndpoints: TargetEndpointDto[];

  @ApiPropertyOptional({
    description: 'Inferred bug category (e.g., API, UI, AUTH, CRASH, VALIDATION)',
    example: 'API',
  })
  inferredCategory?: string;
}

export class ExtractBugParametersDto {
  @ApiPropertyOptional({
    description: 'GitHub issue title',
    example: 'POST /api/v1/projects throws 500 when description contains emojis',
  })
  @IsString()
  @IsOptional()
  issueTitle?: string;

  @ApiProperty({
    description: 'Raw markdown or plain-text body of the GitHub issue report',
    example: '### Steps to Reproduce\n1. Send POST request with emojis\n### Expected\n201 Created\n### Actual\n500 Crash',
  })
  @IsString()
  @IsNotEmpty()
  issueBody: string;

  @ApiPropertyOptional({
    description: 'Repository identifier in owner/repo format',
    example: 'code-with-abhi-i5/CodePulse',
  })
  @IsString()
  @IsOptional()
  repository?: string;
}

export class SynthesizeReproRequestDto {
  @ApiPropertyOptional({
    description: 'GitHub issue number',
    example: 412,
  })
  @IsNumber()
  @IsOptional()
  issueNumber?: number;

  @ApiPropertyOptional({
    description: 'GitHub issue title',
    example: 'TypeError: Cannot read properties of undefined in analytics worker',
  })
  @IsString()
  @IsOptional()
  issueTitle?: string;

  @ApiProperty({
    description: 'Full GitHub issue markdown body containing bug description',
    example: '### Steps to Reproduce\n1. Run worker\n### Expected\nWorker consumes queue\n### Actual\nCrash',
  })
  @IsString()
  @IsNotEmpty()
  issueBody: string;

  @ApiPropertyOptional({
    description: 'Repository name or owner/name identifier',
    example: 'code-with-abhi-i5/CodePulse',
  })
  @IsString()
  @IsOptional()
  repository?: string;

  @ApiPropertyOptional({
    description: 'Target reproduction script language or auto-detection',
    enum: ['auto', 'nodejs', 'python', 'curl', 'bash'],
    default: 'auto',
  })
  @IsString()
  @IsOptional()
  @IsIn(['auto', 'nodejs', 'python', 'curl', 'bash'])
  targetLanguage?: 'auto' | 'nodejs' | 'python' | 'curl' | 'bash';

  @ApiPropertyOptional({
    description: 'Whether to post an automated helper comment directly to the GitHub issue',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  postComment?: boolean;

  @ApiPropertyOptional({
    description: 'GitHub token for posting comments (overrides system GITHUB_TOKEN)',
  })
  @IsString()
  @IsOptional()
  githubToken?: string;
}

export class SynthesizedReproResponseDto {
  @ApiProperty({ description: 'Unique reproduction run ID' })
  id: string;

  @ApiPropertyOptional({ description: 'GitHub issue number' })
  issueNumber?: number;

  @ApiPropertyOptional({ description: 'Repository name' })
  repository?: string;

  @ApiProperty({ description: 'Language of synthesized script', example: 'nodejs' })
  targetLanguage: string;

  @ApiProperty({ description: 'Standalone executable script code' })
  scriptContent: string;

  @ApiProperty({ description: 'Reproducible Dockerfile contents for isolated container run' })
  dockerfileContent: string;

  @ApiProperty({ description: 'Ready-to-run 1-click Docker command for maintainers' })
  dockerRunCommand: string;

  @ApiProperty({ description: 'Whether the generated script syntax was verified as valid' })
  syntaxValid: boolean;

  @ApiPropertyOptional({ description: 'Syntax validation errors if any were found', type: [String] })
  syntaxErrors?: string[];

  @ApiProperty({ description: 'Structured bug parameters extracted from issue body', type: BugReportParameters })
  parameters: BugReportParameters;

  @ApiPropertyOptional({ description: 'Few-shot prompt context used for LLM synthesis' })
  fewShotPromptUsed?: string;

  @ApiProperty({ description: 'Markdown comment helper text formatted for maintainers' })
  commentMarkdown: string;

  @ApiProperty({ description: 'Whether helper comment was posted to GitHub issue' })
  commentPosted: boolean;

  @ApiPropertyOptional({ description: 'URL of posted GitHub comment' })
  commentUrl?: string;

  @ApiProperty({ description: 'Confidence score (0.0 - 1.0) of reproduction script fidelity' })
  confidenceScore: number;

  @ApiProperty({ description: 'Timestamp of generation' })
  createdAt: string;

  @ApiPropertyOptional({ description: 'Whether execution verified the bug' })
  executionSuccess?: boolean;

  @ApiPropertyOptional({ description: 'Output from reproduction run' })
  executionOutput?: string;

  @ApiPropertyOptional({ description: 'Error logs from reproduction run' })
  errorLogs?: string;
}

export class TrackReproExecutionDto {
  @ApiProperty({
    description: 'Whether executing the reproduction script reproduced the reported bug or succeeded as expected',
    example: true,
  })
  @IsBoolean()
  executionSuccess: boolean;

  @ApiPropertyOptional({
    description: 'Standard output logs from running the script',
  })
  @IsString()
  @IsOptional()
  executionOutput?: string;

  @ApiPropertyOptional({
    description: 'Standard error logs or stack trace if execution failed',
  })
  @IsString()
  @IsOptional()
  errorLogs?: string;
}

export class ReproStatsDto {
  @ApiProperty({ description: 'Total number of reproduction scripts synthesized', example: 42 })
  totalSynthesized: number;

  @ApiProperty({ description: 'Percentage of synthesized scripts with valid syntax (0-100)', example: 98.5 })
  syntaxValidRate: number;

  @ApiProperty({ description: 'Percentage of scripts that successfully reproduced bugs (0-100)', example: 87.2 })
  executionSuccessRate: number;

  @ApiProperty({ description: 'Total number of executed reproduction runs tracked', example: 35 })
  totalExecuted: number;

  @ApiProperty({
    description: 'Breakdown of synthesized scripts by target language',
    example: { nodejs: 24, python: 12, curl: 6 },
  })
  languageDistribution: Record<string, number>;

  @ApiProperty({ description: 'Average number of reproduction steps extracted per issue', example: 3.8 })
  averageStepsExtracted: number;
}

