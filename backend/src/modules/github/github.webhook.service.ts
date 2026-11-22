import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangelogGeneratorService } from '../ai/changelog-generator.service';

export interface WebhookPushPayload {
  commits?: Array<{ id: string; message: string; author?: { username?: string; email?: string } }>;
  repository?: { full_name: string; name: string };
  pusher?: { name: string; email?: string };
  ref?: string;
}

export interface WebhookPullRequestPayload {
  action: string;
  pull_request?: {
    number: number;
    title: string;
    merged: boolean;
    user?: { login: string };
  };
  repository?: { full_name: string; name: string };
}

export interface WebhookStarPayload {
  action: string;
  starred_at?: string;
  sender?: { login: string };
  repository?: { full_name: string; name: string };
}

export interface WebhookReleasePayload {
  action: string;
  release?: {
    id: number;
    tag_name: string;
    name: string;
    body: string;
    prerelease: boolean;
    published_at?: string;
    author?: { login: string };
  };
  repository?: { full_name: string; name: string };
}

@Injectable()
export class GithubWebhookService {
  private readonly logger = new Logger(GithubWebhookService.name);
  private readonly processedDeliveries = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly changelogGenerator?: ChangelogGeneratorService,
  ) {}

  isDeliveryProcessed(deliveryId: string): boolean {
    if (!deliveryId) return false;
    return this.processedDeliveries.has(deliveryId);
  }

  recordDelivery(deliveryId: string) {
    if (!deliveryId) return;
    this.processedDeliveries.add(deliveryId);
    // Keep set bounded
    if (this.processedDeliveries.size > 10000) {
      const firstEntries = Array.from(this.processedDeliveries).slice(0, 2000);
      firstEntries.forEach((id) => this.processedDeliveries.delete(id));
    }
  }

  async processPushEvent(payload: WebhookPushPayload) {
    const commits = payload.commits || [];
    const commitCount = commits.length;
    const authorUsername = payload.pusher?.name || commits[0]?.author?.username;
    this.logger.log(`Processing push: ${commitCount} commits by ${authorUsername}`);

    if (!authorUsername || commitCount === 0) return { awardedXp: 0 };

    try {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { username: authorUsername },
            { githubId: authorUsername },
          ],
        },
      });

      if (user) {
        const xpGained = commitCount * 10;
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            xpTransactions: {
              create: {
                amount: xpGained,
                source: 'GITHUB_PUSH',
                description: `GitHub Webhook: Pushed ${commitCount} commits to ${payload.repository?.name || 'repository'}`,
              },
            },
          },
        });
        return { awardedXp: xpGained, userId: user.id };
      }
    } catch (err: any) {
      this.logger.warn(`Could not award push XP: ${err?.message}`);
    }

    return { awardedXp: 0 };
  }

  async processPullRequestEvent(payload: WebhookPullRequestPayload) {
    const isMerged = payload.action === 'closed' && payload.pull_request?.merged === true;
    const authorUsername = payload.pull_request?.user?.login;

    if (!isMerged || !authorUsername) return { awardedXp: 0 };

    try {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { username: authorUsername },
            { githubId: authorUsername },
          ],
        },
      });

      if (user) {
        const xpGained = 50;
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            xpTransactions: {
              create: {
                amount: xpGained,
                source: 'GITHUB_PR_MERGE',
                description: `GitHub Webhook: PR #${payload.pull_request?.number} merged in ${payload.repository?.name || 'repo'}`,
              },
            },
            activities: {
              create: {
                type: 'PULL_REQUEST',
                title: `PR #${payload.pull_request?.number} Merged`,
                description: payload.pull_request?.title || 'Pull request merged',
                repository: payload.repository?.name,
              },
            },
          },
        });
        return { awardedXp: xpGained, userId: user.id };
      }
    } catch (err: any) {
      this.logger.warn(`Could not award PR merge XP: ${err?.message}`);
    }

    return { awardedXp: 0 };
  }

  async processStarEvent(payload: WebhookStarPayload) {
    if (payload.action !== 'created') return { awardedXp: 0 };

    const repoOwner = payload.repository?.full_name?.split('/')[0];
    if (!repoOwner) return { awardedXp: 0 };

    try {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { username: repoOwner },
            { githubId: repoOwner },
          ],
        },
      });

      if (user) {
        const xpGained = 20;
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            xpTransactions: {
              create: {
                amount: xpGained,
                source: 'GITHUB_STAR',
                description: `GitHub Webhook: New star received on ${payload.repository?.name || 'repo'}`,
              },
            },
          },
        });
        return { awardedXp: xpGained, userId: user.id };
      }
    } catch (err: any) {
      this.logger.warn(`Could not award Star XP: ${err?.message}`);
    }

    return { awardedXp: 0 };
  }

  async processReleaseEvent(payload: WebhookReleasePayload) {
    const isPublished = ['published', 'created', 'prereleased'].includes(payload.action);
    const releaseTag = payload.release?.tag_name || 'latest';
    const repoName = payload.repository?.full_name || 'repository';

    this.logger.log(`Processing GitHub release event: ${payload.action} for tag ${releaseTag} in ${repoName}`);

    let changelogMarkdown = '';
    if (this.changelogGenerator && isPublished) {
      try {
        const result = await this.changelogGenerator.generateChangelogFromWebhook(payload);
        changelogMarkdown = result.markdown;
      } catch (err: any) {
        this.logger.warn(`Failed to auto-generate changelog from release webhook: ${err?.message}`);
      }
    }

    // Award XP to release publisher if user exists in database
    const authorUsername = payload.release?.author?.login;
    if (authorUsername && isPublished) {
      try {
        const user = await this.prisma.user.findFirst({
          where: {
            OR: [{ username: authorUsername }, { githubId: authorUsername }],
          },
        });
        if (user) {
          const xpGained = 100;
          await this.prisma.user.update({
            where: { id: user.id },
            data: {
              xpTransactions: {
                create: {
                  amount: xpGained,
                  source: 'GITHUB_RELEASE',
                  description: `GitHub Webhook: Published release ${releaseTag} in ${payload.repository?.name || 'repo'}`,
                },
              },
              activities: {
                create: {
                  type: 'PULL_REQUEST',
                  title: `Release ${releaseTag} Published`,
                  description: payload.release?.name || `Release ${releaseTag}`,
                  repository: payload.repository?.name,
                },
              },
            },
          });
          return {
            releaseTag,
            action: payload.action,
            changelogGenerated: !!changelogMarkdown,
            changelog: changelogMarkdown,
            awardedXp: xpGained,
            userId: user.id,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Could not award Release XP: ${err?.message}`);
      }
    }

    return {
      releaseTag,
      action: payload.action,
      changelogGenerated: !!changelogMarkdown,
      changelog: changelogMarkdown,
      awardedXp: 0,
    };
  }
}

