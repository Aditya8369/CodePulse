import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GenerateChangelogRequestDto,
  ChangelogResponseDto,
  PullRequestInputDto,
  PullRequestContributorDto,
  BreakingChangeDto,
  ChangelogCategoriesDto,
  ChangelogStatsDto,
} from './dto/changelog.dto';

export type SemverCategory =
  | 'features'
  | 'bugFixes'
  | 'breakingChanges'
  | 'performance'
  | 'documentation'
  | 'refactoring';

@Injectable()
export class ChangelogGeneratorService {
  private readonly logger = new Logger(ChangelogGeneratorService.name);

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  /**
   * Main entrypoint: Aggregates merged pull requests, classifies them via SemVer & Conventional Commits,
   * extracts breaking change migration guides, tags contributors, and generates clean GitHub Release markdown.
   */
  async generateChangelog(dto: GenerateChangelogRequestDto): Promise<ChangelogResponseDto> {
    const repository = dto.repository || 'code-with-abhi-i5/CodePulse';
    this.logger.log(`Generating automated release changelog for repository: ${repository}`);

    // Resolve versioning and tag range
    const { tagRange, targetVersion, previousVersion } = this.resolveTagRange(dto);

    // Retrieve PRs (from DTO directly, or fetched via GitHub API)
    const pullRequests = await this.resolvePullRequests(dto, repository, tagRange);

    // Categorize PRs and extract breaking changes
    const { categories, breakingChanges } = this.categorizePullRequests(pullRequests, repository);

    // Extract unique contributors
    const contributors = this.extractContributors(pullRequests);

    // Compute aggregated metrics
    const stats = this.computeStats(pullRequests, contributors.length);

    // Format clean GitHub Release markdown
    const releaseTitle =
      dto.releaseTitle || `Release ${targetVersion}: What's Changed`;
    const markdown = this.formatMarkdown({
      repository,
      targetVersion,
      previousVersion,
      tagRange,
      releaseTitle,
      categories,
      breakingChanges,
      contributors,
      stats,
      includeStats: dto.includeStats !== false,
      includeContributors: dto.includeContributors !== false,
    });

    // Optionally persist into database
    await this.persistChangelogSafely({
      repository,
      targetVersion,
      previousVersion,
      tagRange,
      releaseTitle,
      markdown,
      prCount: pullRequests.length,
      contributorsCount: contributors.length,
      categories,
      breakingChanges,
      contributors,
    });

    return {
      targetVersion,
      previousVersion,
      tagRange,
      releaseTitle,
      markdown,
      categories,
      breakingChanges,
      contributors,
      stats,
    };
  }

  /**
   * Resolves target version, previous version, and comparison tag range.
   */
  public resolveTagRange(dto: GenerateChangelogRequestDto): {
    tagRange: string;
    targetVersion: string;
    previousVersion?: string;
  } {
    if (dto.tagRange && dto.tagRange.includes('...')) {
      const parts = dto.tagRange.split('...');
      const previousVersion = dto.previousVersion || parts[0].trim();
      const targetVersion = dto.targetVersion || parts[1].trim();
      return { tagRange: dto.tagRange.trim(), targetVersion, previousVersion };
    }

    const targetVersion = dto.targetVersion || 'v1.1.0';
    const previousVersion = dto.previousVersion || this.derivePreviousVersion(targetVersion);
    const tagRange = `${previousVersion}...${targetVersion}`;

    return { tagRange, targetVersion, previousVersion };
  }

  /**
   * Derives previous SemVer tag if omitted (e.g. v1.1.0 -> v1.0.0).
   */
  private derivePreviousVersion(version: string): string {
    const clean = version.replace(/^v/, '');
    const parts = clean.split('.').map((p) => parseInt(p, 10) || 0);
    if (parts.length >= 2) {
      if (parts[1] > 0) {
        parts[1] -= 1;
      } else if (parts[0] > 0) {
        parts[0] -= 1;
        parts[1] = 0;
      }
      return `v${parts.join('.')}`;
    }
    return 'v1.0.0';
  }

  /**
   * Resolves pull requests either from input DTO or by querying GitHub API.
   */
  public async resolvePullRequests(
    dto: GenerateChangelogRequestDto,
    repository: string,
    tagRange: string,
  ): Promise<PullRequestInputDto[]> {
    if (dto.pullRequests && dto.pullRequests.length > 0) {
      return dto.pullRequests;
    }

    // Try fetching via GitHub API if network and token are available
    try {
      const fetched = await this.fetchPullRequestsFromGitHub(
        repository,
        tagRange,
        dto.pullRequestNumbers,
      );
      if (fetched.length > 0) {
        return fetched;
      }
    } catch (err: any) {
      this.logger.warn(`GitHub API query for changelog PRs failed: ${err?.message}. Falling back to default changelog.`);
    }

    return [];
  }

  /**
   * Queries GitHub compare and pull request endpoints to retrieve merged PRs.
   */
  public async fetchPullRequestsFromGitHub(
    repository: string,
    tagRange: string,
    prNumbers?: number[],
  ): Promise<PullRequestInputDto[]> {
    const token = this.configService?.get<string>('GITHUB_TOKEN');
    const headers: Record<string, string> = {
      'User-Agent': 'CodePulse-Changelog-Generator',
      Accept: 'application/vnd.github.v3+json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const prList: PullRequestInputDto[] = [];

    // If explicit PR numbers were provided, fetch each PR
    if (prNumbers && prNumbers.length > 0) {
      for (const num of prNumbers) {
        try {
          const res = await axios.get(
            `https://api.github.com/repos/${repository}/pulls/${num}`,
            { headers, timeout: 8000 },
          );
          const pr = res.data;
          prList.push({
            number: pr.number,
            title: pr.title,
            description: pr.body || '',
            author: {
              login: pr.user?.login || 'contributor',
              avatarUrl: pr.user?.avatar_url || `https://github.com/${pr.user?.login}.png`,
              htmlUrl: pr.user?.html_url || `https://github.com/${pr.user?.login}`,
            },
            url: pr.html_url,
            mergedAt: pr.merged_at,
            filesChanged: pr.changed_files || 1,
            additions: pr.additions || 0,
            deletions: pr.deletions || 0,
            labels: (pr.labels || []).map((l: any) => (typeof l === 'string' ? l : l.name)),
          });
        } catch (e: any) {
          this.logger.warn(`Failed to fetch PR #${num}: ${e?.message}`);
        }
      }
      return prList;
    }

    // Otherwise, query commit compare endpoint to discover merged PR numbers
    try {
      const compareRes = await axios.get(
        `https://api.github.com/repos/${repository}/compare/${tagRange}`,
        { headers, timeout: 8000 },
      );
      const commits = compareRes.data?.commits || [];
      const discoveredPrNumbers = new Set<number>();

      for (const commit of commits) {
        const msg = commit.commit?.message || '';
        const match =
          msg.match(/Merge pull request #(\d+)/i) ||
          msg.match(/\(#(\d+)\)/) ||
          msg.match(/PR:?\s*#?(\d+)/i);
        if (match && match[1]) {
          discoveredPrNumbers.add(parseInt(match[1], 10));
        }
      }

      if (discoveredPrNumbers.size > 0) {
        return this.fetchPullRequestsFromGitHub(
          repository,
          tagRange,
          Array.from(discoveredPrNumbers),
        );
      }
    } catch (err: any) {
      this.logger.debug(`Could not compare range ${tagRange}: ${err?.message}`);
    }

    return prList;
  }

  /**
   * Categorizes pull requests into Conventional Commits SemVer sections and extracts breaking changes.
   */
  public categorizePullRequests(
    prs: PullRequestInputDto[],
    repository: string,
  ): {
    categories: ChangelogCategoriesDto;
    breakingChanges: BreakingChangeDto[];
  } {
    const categories: ChangelogCategoriesDto = {
      features: [],
      bugFixes: [],
      breakingChanges: [],
      performance: [],
      documentation: [],
      refactoring: [],
    };

    const breakingChanges: BreakingChangeDto[] = [];

    for (const pr of prs) {
      const { category, isBreaking, breakingDetails } = this.classifyPullRequest(pr);

      // Add to primary SemVer category
      categories[category].push(pr);

      // If it introduces breaking changes, also include in breaking changes section & registry
      if (isBreaking) {
        if (!categories.breakingChanges.includes(pr)) {
          categories.breakingChanges.push(pr);
        }
        if (breakingDetails) {
          breakingChanges.push(breakingDetails);
        }
      }
    }

    return { categories, breakingChanges };
  }

  /**
   * Classifies an individual pull request into its Conventional Commit category
   * and inspects for breaking changes with migration advice.
   */
  public classifyPullRequest(pr: PullRequestInputDto): {
    category: SemverCategory;
    isBreaking: boolean;
    breakingDetails?: BreakingChangeDto;
  } {
    const title = (pr.title || '').trim();
    const description = (pr.description || '').trim();
    const labels = (pr.labels || []).map((l) => l.toLowerCase());
    const authorName = pr.author?.login || 'contributor';

    // 1. Check for Breaking Changes
    const hasBreakingExclamation = /^[a-z]+(\([a-z0-9_-]+\))?!:/i.test(title);
    const hasBreakingTitle = /^breaking(\s*change)?:/i.test(title);
    const hasBreakingLabel = labels.some((l) =>
      ['breaking', 'breaking-change', 'breaking_change'].includes(l),
    );
    const hasBreakingBodyMarker =
      /BREAKING[\s-_]?CHANGE/i.test(description) ||
      /##\s*(Breaking Change|Breaking Changes)/i.test(description) ||
      /###\s*(Breaking Change|Breaking Changes)/i.test(description);

    const isBreaking =
      hasBreakingExclamation ||
      hasBreakingTitle ||
      hasBreakingLabel ||
      hasBreakingBodyMarker;

    let breakingDetails: BreakingChangeDto | undefined;
    if (isBreaking) {
      breakingDetails = this.extractBreakingChangeDetails(pr);
    }

    // 2. Classify based on Conventional Commit prefix & keywords
    const lowerTitle = title.toLowerCase();

    // Features
    if (
      /^feat(\([a-z0-9_-]+\))?:/i.test(title) ||
      labels.some((l) => ['feature', 'enhancement', 'feat'].includes(l)) ||
      /\b(add|implement|introduce|support|create|allow|support for)\b/i.test(lowerTitle)
    ) {
      return { category: 'features', isBreaking, breakingDetails };
    }

    // Bug Fixes
    if (
      /^fix(\([a-z0-9_-]+\))?:/i.test(title) ||
      labels.some((l) => ['bug', 'fix', 'bugfix'].includes(l)) ||
      /\b(fix|resolve|patch|prevent crash|handle error|correct)\b/i.test(lowerTitle)
    ) {
      return { category: 'bugFixes', isBreaking, breakingDetails };
    }

    // Performance Improvements
    if (
      /^perf(\([a-z0-9_-]+\))?:/i.test(title) ||
      labels.some((l) => ['perf', 'performance', 'optimization'].includes(l)) ||
      /\b(perf|performance|optimize|speed up|latency|memory leak|cache)\b/i.test(lowerTitle)
    ) {
      return { category: 'performance', isBreaking, breakingDetails };
    }

    // Documentation
    if (
      /^docs?(\([a-z0-9_-]+\))?:/i.test(title) ||
      labels.some((l) => ['docs', 'documentation'].includes(l)) ||
      /\b(docs?|readme|guide|swagger|openapi|docstring|changelog)\b/i.test(lowerTitle)
    ) {
      return { category: 'documentation', isBreaking, breakingDetails };
    }

    // Refactoring / Internal Chores
    if (
      /^(refactor|chore|style|test|ci|build)(\([a-z0-9_-]+\))?:/i.test(title) ||
      labels.some((l) => ['refactor', 'chore', 'tests', 'ci'].includes(l))
    ) {
      return { category: 'refactoring', isBreaking, breakingDetails };
    }

    // Fallback: If breaking change without specific prefix, default to refactoring
    if (isBreaking) {
      return { category: 'refactoring', isBreaking, breakingDetails };
    }

    // Default category
    return { category: 'refactoring', isBreaking, breakingDetails };
  }

  /**
   * Extracts breaking change description and actionable migration advice from PR body or title.
   */
  public extractBreakingChangeDetails(pr: PullRequestInputDto): BreakingChangeDto {
    const body = pr.description || '';
    const title = pr.title || '';
    const author = pr.author?.login || 'contributor';

    let description = '';
    let migrationAdvice = '';

    // Strategy A: Explicit "Migration Guide" or "Migration Advice" section
    const migrationMatch =
      body.match(/#{2,4}\s*Migration (?:Guide|Advice)[\r\n]+([\s\S]*?)(?=(?:#{2,4}\s|$))/i) ||
      body.match(/Migration (?:Guide|Advice):\s*([^\r\n]+(?:\r?\n[^\r\n]+)*)/i);
    if (migrationMatch && migrationMatch[1]) {
      migrationAdvice = migrationMatch[1].trim();
    }

    // Strategy B: Explicit "BREAKING CHANGE:" or "BREAKING CHANGES:" marker
    const breakingMarkerMatch = body.match(
      /BREAKING[\s-_]?CHANGES?:\s*([^\r\n]+(?:\r?\n[^\r\n]+)*)/i,
    );
    if (breakingMarkerMatch && breakingMarkerMatch[1]) {
      const rawText = breakingMarkerMatch[1].trim();
      // If no separate migration advice found, use marker text
      if (!description) description = rawText;
      if (!migrationAdvice) {
        migrationAdvice = `Ensure compatibility with updated interface: ${rawText}`;
      }
    }

    // Strategy C: Markdown Section "## Breaking Changes"
    const sectionMatch = body.match(
      /#{2,4}\s*Breaking Changes?[\r\n]+([\s\S]*?)(?=(?:#{2,4}\s|$))/i,
    );
    if (sectionMatch && sectionMatch[1]) {
      const sectionText = sectionMatch[1].trim();
      if (!description) description = sectionText;
      if (!migrationAdvice) {
        migrationAdvice = sectionText;
      }
    }

    // Fallback if neither found in body
    if (!description) {
      description = title.replace(/^[a-z]+(\([a-z0-9_-]+\))?!:\s*/i, '');
    }
    if (!migrationAdvice) {
      migrationAdvice = `Review client integration and verify dependencies against the breaking changes in #${pr.number}.`;
    }

    // Clean markdown headings from migration advice if needed
    migrationAdvice = migrationAdvice.replace(/^#+\s+/gm, '').trim();

    return {
      prNumber: pr.number,
      title: title.replace(/^[a-z]+(\([a-z0-9_-]+\))?!:\s*/i, ''),
      description,
      migrationAdvice,
      author,
    };
  }

  /**
   * Aggregates distinct contributors, tracking PR counts and profile links.
   */
  public extractContributors(prs: PullRequestInputDto[]): PullRequestContributorDto[] {
    const map = new Map<string, PullRequestContributorDto>();

    for (const pr of prs) {
      const login = pr.author?.login || 'unknown';
      if (!map.has(login)) {
        map.set(login, {
          login,
          avatarUrl: pr.author?.avatarUrl || `https://github.com/${login}.png`,
          htmlUrl: pr.author?.htmlUrl || `https://github.com/${login}`,
          prCount: 1,
        });
      } else {
        const existing = map.get(login)!;
        existing.prCount = (existing.prCount || 1) + 1;
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => (b.prCount || 0) - (a.prCount || 0) || a.login.localeCompare(b.login),
    );
  }

  /**
   * Computes aggregated diff statistics across all pull requests.
   */
  public computeStats(prs: PullRequestInputDto[], contributorsCount: number): ChangelogStatsDto {
    let filesChanged = 0;
    let additions = 0;
    let deletions = 0;

    for (const pr of prs) {
      filesChanged += pr.filesChanged || 1;
      additions += pr.additions || 0;
      deletions += pr.deletions || 0;
    }

    return {
      totalPRs: prs.length,
      filesChanged,
      additions,
      deletions,
      totalContributors: contributorsCount,
    };
  }

  /**
   * Formats the final clean GitHub Release markdown document.
   */
  public formatMarkdown(opts: {
    repository: string;
    targetVersion: string;
    previousVersion?: string;
    tagRange: string;
    releaseTitle: string;
    categories: ChangelogCategoriesDto;
    breakingChanges: BreakingChangeDto[];
    contributors: PullRequestContributorDto[];
    stats: ChangelogStatsDto;
    includeStats: boolean;
    includeContributors: boolean;
  }): string {
    const {
      repository,
      targetVersion,
      previousVersion,
      tagRange,
      releaseTitle,
      categories,
      breakingChanges,
      contributors,
      stats,
      includeStats,
      includeContributors,
    } = opts;

    const lines: string[] = [];

    // Header
    lines.push(`# ${releaseTitle}`);
    lines.push('');
    lines.push(`## What's Changed in ${targetVersion}`);
    if (previousVersion) {
      lines.push(`*Comparing changes from \`${previousVersion}\` to \`${targetVersion}\`*`);
    }
    lines.push('');

    // 1. Breaking Changes Section
    if (breakingChanges.length > 0) {
      lines.push('### ⚠️ Breaking Changes');
      for (const bc of breakingChanges) {
        lines.push(
          `* **${bc.title}** by @${bc.author} in [#${bc.prNumber}](https://github.com/${repository}/pull/${bc.prNumber})`,
        );
        if (bc.migrationAdvice) {
          lines.push(`  > **Migration Advice**: ${bc.migrationAdvice}`);
        }
      }
      lines.push('');
    }

    // Helper for regular category items
    const formatCategory = (title: string, prs: PullRequestInputDto[]) => {
      if (!prs || prs.length === 0) return;
      lines.push(title);
      for (const pr of prs) {
        const authorHandle = pr.author?.login ? `@${pr.author.login}` : 'contributor';
        const prUrl =
          pr.url || `https://github.com/${repository}/pull/${pr.number}`;
        const diffBadge =
          pr.additions !== undefined && pr.deletions !== undefined
            ? ` (\`+${pr.additions}\`, \`-${pr.deletions}\`)`
            : '';
        lines.push(
          `* ${this.cleanPrTitle(pr.title)} by ${authorHandle} in [#${pr.number}](${prUrl})${diffBadge}`,
        );
      }
      lines.push('');
    };

    // 2. Features
    formatCategory('### 🚀 Features', categories.features);

    // 3. Bug Fixes
    formatCategory('### 🐛 Bug Fixes', categories.bugFixes);

    // 4. Performance Improvements
    formatCategory('### ⚡ Performance Improvements', categories.performance);

    // 5. Documentation
    formatCategory('### 📝 Documentation', categories.documentation);

    // 6. Internal Refactoring
    formatCategory('### 🛠️ Internal Refactoring', categories.refactoring);

    // 7. Diff Statistics Table
    if (includeStats && stats.totalPRs > 0) {
      lines.push('---');
      lines.push('### 📊 Release Statistics');
      lines.push('| Metric | Count |');
      lines.push('|:---|:---|');
      lines.push(`| Merged Pull Requests | **${stats.totalPRs}** |`);
      lines.push(`| Total Files Modified | **${stats.filesChanged}** |`);
      lines.push(`| Lines Added | **+${stats.additions.toLocaleString()}** |`);
      lines.push(`| Lines Deleted | **-${stats.deletions.toLocaleString()}** |`);
      lines.push(`| Active Contributors | **${stats.totalContributors}** |`);
      lines.push('');
    }

    // 8. Contributor Shoutouts
    if (includeContributors && contributors.length > 0) {
      lines.push('---');
      lines.push('### 👥 Contributors');
      lines.push('Huge thanks to all the contributors who contributed to this release:');
      lines.push('');
      for (const c of contributors) {
        const prCountLabel =
          c.prCount && c.prCount > 1 ? ` (${c.prCount} PRs)` : '';
        lines.push(
          `* <a href="${c.htmlUrl}"><img src="${c.avatarUrl}" width="20" height="20" alt="@${c.login}" style="border-radius: 50%; vertical-align: middle;" /></a> [@${c.login}](${c.htmlUrl})${prCountLabel}`,
        );
      }
      lines.push('');
    }

    // 9. Full Compare Diff Link
    lines.push('---');
    lines.push(
      `**Full Changelog**: https://github.com/${repository}/compare/${tagRange}`,
    );

    return lines.join('\n');
  }

  /**
   * Sanitizes PR titles for changelog display, normalizing Conventional Commit prefixes.
   */
  private cleanPrTitle(title: string): string {
    if (!title) return '';
    // Format conventional commit prefix into bold scope: feat(auth): something -> **auth**: something
    const match = title.match(/^[a-z]+(?:\(([a-z0-9_-]+)\))?!?:\s*(.*)/i);
    if (match && match[1] && match[2]) {
      return `**${match[1]}**: ${match[2]}`;
    }
    return title;
  }

  /**
   * Automates changelog generation from a GitHub Release webhook payload.
   */
  public async generateChangelogFromWebhook(payload: any): Promise<ChangelogResponseDto> {
    const repository = payload.repository?.full_name || 'code-with-abhi-i5/CodePulse';
    const targetVersion = payload.release?.tag_name || 'v1.1.0';
    const releaseTitle = payload.release?.name || `Release ${targetVersion}`;

    this.logger.log(`Handling GitHub release webhook for ${repository} (${targetVersion})`);

    return this.generateChangelog({
      repository,
      targetVersion,
      releaseTitle,
      includeStats: true,
      includeContributors: true,
    });
  }

  /**
   * Gracefully persists changelogs into PostgreSQL if the Prisma table exists.
   */
  private async persistChangelogSafely(data: {
    repository: string;
    targetVersion: string;
    previousVersion?: string;
    tagRange: string;
    releaseTitle: string;
    markdown: string;
    prCount: number;
    contributorsCount: number;
    categories: ChangelogCategoriesDto;
    breakingChanges: BreakingChangeDto[];
    contributors: PullRequestContributorDto[];
  }): Promise<void> {
    if (!this.prisma) return;

    try {
      await (this.prisma as any).releaseChangelog?.create({
        data: {
          repository: data.repository,
          targetVersion: data.targetVersion,
          previousVersion: data.previousVersion,
          tagRange: data.tagRange,
          title: data.releaseTitle,
          markdown: data.markdown,
          prCount: data.prCount,
          contributorsCount: data.contributorsCount,
          rawCategories: data.categories as any,
          breakingChanges: data.breakingChanges as any,
          contributors: data.contributors as any,
        },
      });
      this.logger.log(`Persisted changelog for ${data.repository} @ ${data.targetVersion}`);
    } catch (err: any) {
      this.logger.warn(`Could not persist release changelog: ${err?.message}`);
    }
  }
}
