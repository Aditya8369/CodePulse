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

export class PullRequestContributorDto {
  @ApiProperty({ description: 'GitHub username handle', example: 'octocat' })
  @IsString()
  @IsNotEmpty()
  login: string;

  @ApiPropertyOptional({
    description: 'Avatar image URL',
    example: 'https://avatars.githubusercontent.com/u/583231',
  })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'Profile URL',
    example: 'https://github.com/octocat',
  })
  @IsString()
  @IsOptional()
  htmlUrl?: string;

  @ApiPropertyOptional({
    description: 'Number of merged pull requests in this release',
    example: 2,
  })
  @IsNumber()
  @IsOptional()
  prCount?: number;
}

export class PullRequestInputDto {
  @ApiProperty({ description: 'Pull request number', example: 104 })
  @IsNumber()
  number: number;

  @ApiProperty({
    description: 'Pull request title',
    example: 'feat(battles): implement private match lobbies with room passcodes',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: 'Pull request body/description',
    example: 'Implements password-protected private matchmaking lobbies.\n\nBREAKING CHANGE: Room payload requires passcode field.',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Pull request author',
    type: () => PullRequestContributorDto,
  })
  @ValidateNested()
  @Type(() => PullRequestContributorDto)
  author: PullRequestContributorDto;

  @ApiPropertyOptional({
    description: 'GitHub HTML URL for this pull request',
    example: 'https://github.com/code-with-abhi-i5/CodePulse/pull/104',
  })
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional({
    description: 'Timestamp when the PR was merged',
    example: '2026-11-20T14:32:00Z',
  })
  @IsString()
  @IsOptional()
  mergedAt?: string;

  @ApiPropertyOptional({
    description: 'Total number of modified files',
    example: 8,
  })
  @IsNumber()
  @IsOptional()
  filesChanged?: number;

  @ApiPropertyOptional({
    description: 'Total number of added lines',
    example: 320,
  })
  @IsNumber()
  @IsOptional()
  additions?: number;

  @ApiPropertyOptional({
    description: 'Total number of deleted lines',
    example: 45,
  })
  @IsNumber()
  @IsOptional()
  deletions?: number;

  @ApiPropertyOptional({
    description: 'Labels assigned to the PR',
    example: ['feature', 'backend'],
    type: [String],
  })
  @IsArray()
  @IsOptional()
  labels?: string[];
}

export class BreakingChangeDto {
  @ApiProperty({ description: 'Pull request number', example: 101 })
  @IsNumber()
  prNumber: number;

  @ApiProperty({ description: 'Title or summary of the breaking change' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Detailed explanation of the breaking change' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Actionable migration advice for consumers' })
  @IsString()
  migrationAdvice: string;

  @ApiProperty({ description: 'Author of the breaking change' })
  @IsString()
  author: string;
}

export class ChangelogCategoriesDto {
  @ApiProperty({
    description: 'Features (feat)',
    type: [PullRequestInputDto],
  })
  features: PullRequestInputDto[];

  @ApiProperty({
    description: 'Bug Fixes (fix)',
    type: [PullRequestInputDto],
  })
  bugFixes: PullRequestInputDto[];

  @ApiProperty({
    description: 'Breaking Changes (breaking or !)',
    type: [PullRequestInputDto],
  })
  breakingChanges: PullRequestInputDto[];

  @ApiProperty({
    description: 'Performance Improvements (perf)',
    type: [PullRequestInputDto],
  })
  performance: PullRequestInputDto[];

  @ApiProperty({
    description: 'Documentation (docs)',
    type: [PullRequestInputDto],
  })
  documentation: PullRequestInputDto[];

  @ApiProperty({
    description: 'Internal Refactoring (refactor, chore, test, ci)',
    type: [PullRequestInputDto],
  })
  refactoring: PullRequestInputDto[];
}

export class ChangelogStatsDto {
  @ApiProperty({ description: 'Total number of merged pull requests', example: 12 })
  @IsNumber()
  totalPRs: number;

  @ApiProperty({ description: 'Total modified files', example: 45 })
  @IsNumber()
  filesChanged: number;

  @ApiProperty({ description: 'Total lines added across all PRs', example: 1420 })
  @IsNumber()
  additions: number;

  @ApiProperty({ description: 'Total lines deleted across all PRs', example: 380 })
  @IsNumber()
  deletions: number;

  @ApiProperty({ description: 'Distinct contributor count', example: 6 })
  @IsNumber()
  totalContributors: number;
}

export class GenerateChangelogRequestDto {
  @ApiProperty({
    description: 'Target GitHub repository in "owner/repo" format',
    example: 'code-with-abhi-i5/CodePulse',
  })
  @IsString()
  @IsNotEmpty()
  repository: string;

  @ApiPropertyOptional({
    description: 'Git tag comparison range (e.g. "v1.0.0...v1.1.0")',
    example: 'v1.0.0...v1.1.0',
  })
  @IsString()
  @IsOptional()
  tagRange?: string;

  @ApiPropertyOptional({
    description: 'Target release version (defaults to head tag or latest tag)',
    example: 'v1.1.0',
  })
  @IsString()
  @IsOptional()
  targetVersion?: string;

  @ApiPropertyOptional({
    description: 'Previous release version (defaults to base tag)',
    example: 'v1.0.0',
  })
  @IsString()
  @IsOptional()
  previousVersion?: string;

  @ApiPropertyOptional({
    description: 'Explicit list of merged pull request numbers to aggregate',
    example: [101, 102, 103],
    type: [Number],
  })
  @IsArray()
  @IsOptional()
  pullRequestNumbers?: number[];

  @ApiPropertyOptional({
    description: 'Array of pull request objects for direct or offline generation',
    type: [PullRequestInputDto],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PullRequestInputDto)
  pullRequests?: PullRequestInputDto[];

  @ApiPropertyOptional({
    description: 'Whether to include diff statistics in the release markdown',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  includeStats?: boolean;

  @ApiPropertyOptional({
    description: 'Whether to include contributor shoutouts with avatar badges',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  includeContributors?: boolean;

  @ApiPropertyOptional({
    description: 'Custom title for the release notes',
    example: 'CodePulse 1.1.0: Realtime Battles & Cloud Sandboxes',
  })
  @IsString()
  @IsOptional()
  releaseTitle?: string;
}

export class ChangelogResponseDto {
  @ApiProperty({ description: 'Release target version', example: 'v1.1.0' })
  targetVersion: string;

  @ApiPropertyOptional({ description: 'Previous release version', example: 'v1.0.0' })
  previousVersion?: string;

  @ApiProperty({ description: 'Git comparison range', example: 'v1.0.0...v1.1.0' })
  tagRange: string;

  @ApiProperty({ description: 'Title of the release' })
  releaseTitle: string;

  @ApiProperty({ description: 'Fully formatted GitHub Release Markdown document' })
  markdown: string;

  @ApiProperty({ description: 'Categorized pull requests by SemVer category', type: () => ChangelogCategoriesDto })
  categories: ChangelogCategoriesDto;

  @ApiProperty({
    description: 'Extracted breaking changes with migration advice',
    type: [BreakingChangeDto],
  })
  breakingChanges: BreakingChangeDto[];

  @ApiProperty({
    description: 'Attributed contributors with avatar metadata',
    type: [PullRequestContributorDto],
  })
  contributors: PullRequestContributorDto[];

  @ApiProperty({ description: 'Aggregated release statistics', type: () => ChangelogStatsDto })
  stats: ChangelogStatsDto;
}
