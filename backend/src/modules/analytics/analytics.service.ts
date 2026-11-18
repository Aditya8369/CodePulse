import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Inject,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import axios from 'axios';
import { DifferentialPrivacyService } from './differential-privacy.service';

type GitHubCommit = { commit?: { committer?: { date?: string }; author?: { date?: string } } };
type PunchcardCache = { timestamps: string[]; truncated: boolean };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_COMMIT_PAGES = 10;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Optional() private readonly dpService?: DifferentialPrivacyService,
  ) {}

  async getRepositoryCommitPunchcard(userId: string, repositoryId: string, timezone = 'UTC') {
    if (timezone.length > 64) throw new BadRequestException('Invalid timezone');
    let formatter: Intl.DateTimeFormat;
    try {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone, weekday: 'short', hour: '2-digit', hourCycle: 'h23',
      });
    } catch {
      throw new BadRequestException('Invalid timezone');
    }

    const repo = await this.prisma.repository.findFirst({ where: { id: repositoryId, userId } });
    if (!repo) throw new NotFoundException('Repository not found');
    if (repo.isPrivate) throw new UnprocessableEntityException('Punchcard is available for public repositories only');
    const [owner, name, ...rest] = repo.fullName.split('/');
    if (!owner || !name || rest.length > 0) throw new BadRequestException('Invalid repository name');

    const cacheKey = `analytics:punchcard:commits:${repositoryId}`;
    let cached = await this.cache.get<PunchcardCache>(cacheKey);
    if (!cached) {
      const timestamps: string[] = [];
      let truncated = false;
      const token = this.config.get<string>('GITHUB_TOKEN');
      const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
      for (let page = 1; page <= MAX_COMMIT_PAGES; page++) {
        let commits: GitHubCommit[];
        try {
          const response = await axios.get<GitHubCommit[]>(
            `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits`,
            {
              params: { per_page: 100, page, since },
              headers: {
                'User-Agent': 'CodePulse-Developer-Platform',
                Accept: 'application/vnd.github+json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              timeout: 10_000,
            },
          );
          commits = response.data;
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 409) break;
          throw new BadGatewayException('Could not load repository commit history');
        }
        timestamps.push(...commits.flatMap((item) => {
          const date = item.commit?.committer?.date ?? item.commit?.author?.date;
          return date && !Number.isNaN(Date.parse(date)) ? [date] : [];
        }));
        if (commits.length < 100) break;
        if (page === MAX_COMMIT_PAGES) truncated = true;
      }
      cached = { timestamps, truncated };
      await this.cache.set(cacheKey, cached, 5 * 60 * 1000);
    }

    const matrix = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
    for (const timestamp of cached.timestamps) {
      const parts = formatter.formatToParts(new Date(timestamp));
      const day = DAYS.indexOf(parts.find((part) => part.type === 'weekday')?.value ?? '');
      const hour = Number(parts.find((part) => part.type === 'hour')?.value);
      if (day >= 0 && Number.isInteger(hour) && hour >= 0 && hour < 24) matrix[day][hour]++;
    }
    return { repositoryId, timezone, matrix, sampledCommits: cached.timestamps.length, truncated: cached.truncated };
  }

  async getPlatformStats() {
    // Mock implementation for platform stats
    return {
      activeDevelopers: 250000,
      commitsAnalyzed: 12000000,
      battlesFought: 500000,
      uptime: '99.9%',
    };
  }

  async getUserAnalytics(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { stats: true, languages: true },
    });

    if (!user) {
      throw new NotFoundException(`User @${username} not found`);
    }

    return {
      stats: user.stats,
      languages: user.languages,
      // More aggregated data can be added here (e.g. contribution heatmap data)
    };
  }

  async getPrivacySafeAggregations(userId: string, epsilon = 1.0) {
    const dp = this.dpService ?? new DifferentialPrivacyService();
    const users = await this.prisma.user.findMany({
      include: { stats: true },
      take: 250,
    });

    const cohortData = users.map((u) => {
      const statsRecord = (u.stats ?? {}) as Record<string, unknown>;
      const xpVal =
        typeof statsRecord.xp === 'number'
          ? statsRecord.xp
          : typeof statsRecord.totalCommits === 'number'
            ? statsRecord.totalCommits
            : 0;
      return {
        id: u.id,
        metric: xpVal,
      };
    });

    const privacyResult = dp.privatizeQuery(
      cohortData,
      (item) => item.metric,
      {
        epsilon,
        sensitivity: 1000,
        consumerKey: userId,
        maxAllowedBudget: 10.0,
      },
    );

    const budgetStatus = dp.getBudgetStatus(userId, 10.0);

    return {
      query: 'platform-developer-metric-aggregate',
      epsilonRequested: epsilon,
      privacyBudget: budgetStatus,
      cohortAnalysis: {
        rawCohortSize: cohortData.length,
        suppressed: privacyResult.suppressed,
        minCohortThreshold: 5,
      },
      result: privacyResult.suppressed
        ? null
        : {
            noisyAggregateValue: privacyResult.noisyValue,
            noiseMechanism: `Laplace(sensitivity=1000, epsilon=${epsilon})`,
          },
    };
  }
}
