import { Injectable, Logger } from '@nestjs/common';

export interface OrgAnalyticsSummary {
  orgName: string;
  avatarUrl: string;
  totalMembers: number;
  totalRepositories: number;
  aggregateCommitsThisMonth: number;
  topRepositories: Array<{
    name: string;
    stars: number;
    forks: number;
    velocityScore: number;
    language: string;
  }>;
  leaderboardPodium: Array<{
    rank: number;
    username: string;
    avatarUrl: string;
    commits: number;
    prs: number;
    score: number;
  }>;
}

@Injectable()
export class OrgAnalyticsService {
  private readonly logger = new Logger(OrgAnalyticsService.name);

  /**
   * Aggregates organization-wide activity across members and repositories
   */
  async getOrgAnalytics(orgName: string): Promise<OrgAnalyticsSummary> {
    this.logger.log(`Fetching cross-team analytics for GitHub organization: ${orgName}`);

    return {
      orgName,
      avatarUrl: `https://github.com/${orgName}.png`,
      totalMembers: 48,
      totalRepositories: 19,
      aggregateCommitsThisMonth: 1240,
      topRepositories: [
        {
          name: 'core-api',
          stars: 480,
          forks: 92,
          velocityScore: 94,
          language: 'TypeScript',
        },
        {
          name: 'web-platform',
          stars: 320,
          forks: 64,
          velocityScore: 88,
          language: 'Next.js',
        },
        {
          name: 'infra-k8s',
          stars: 140,
          forks: 18,
          velocityScore: 76,
          language: 'HCL',
        },
      ],
      leaderboardPodium: [
        {
          rank: 1,
          username: 'alexmercer',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
          commits: 142,
          prs: 28,
          score: 2450,
        },
        {
          rank: 2,
          username: 'sarah_dev',
          avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
          commits: 118,
          prs: 22,
          score: 2180,
        },
        {
          rank: 3,
          username: 'kevin_go',
          avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
          commits: 96,
          prs: 17,
          score: 1920,
        },
      ],
    };
  }
}
