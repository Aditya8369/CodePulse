import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface BountyItem {
  id: string;
  repoId: string;
  repoName: string;
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
  xpReward: number;
  sponsorUsername: string;
  status: 'OPEN' | 'CLAIMED' | 'REFUNDED';
  claimedBy?: string;
  createdAt: Date;
}

@Injectable()
export class BountiesService {
  constructor(private readonly prisma: PrismaService) {}

  private static bounties: BountyItem[] = [
    {
      id: 'bty_1',
      repoId: 'repo_cp_core',
      repoName: 'CodePulse/core',
      issueNumber: 42,
      issueTitle: 'Implement zero-copy JSON parser for battle webhooks',
      issueUrl: 'https://github.com/CodePulse/core/issues/42',
      xpReward: 350,
      sponsorUsername: 'alexmercer',
      status: 'OPEN',
      createdAt: new Date(),
    },
    {
      id: 'bty_2',
      repoId: 'repo_cp_web',
      repoName: 'CodePulse/web',
      issueNumber: 108,
      issueTitle: 'Refactor chart components with virtualized canvas rendering',
      issueUrl: 'https://github.com/CodePulse/web/issues/108',
      xpReward: 500,
      sponsorUsername: 'sarah_dev',
      status: 'OPEN',
      createdAt: new Date(),
    },
  ];

  async getOpenBounties(): Promise<BountyItem[]> {
    return BountiesService.bounties.filter(b => b.status === 'OPEN');
  }

  async createBounty(payload: Omit<BountyItem, 'id' | 'status' | 'createdAt'>): Promise<BountyItem> {
    if (payload.xpReward <= 0) {
      throw new BadRequestException('Bounty XP reward must be greater than zero.');
    }

    const newBounty: BountyItem = {
      ...payload,
      id: `bty_${Date.now()}`,
      status: 'OPEN',
      createdAt: new Date(),
    };

    BountiesService.bounties.push(newBounty);
    return newBounty;
  }

  /**
   * Automatically triggered by GitHub pull_request.merged webhook event
   */
  async claimBounty(issueNumber: number, claimerUsername: string): Promise<BountyItem> {
    const bounty = BountiesService.bounties.find(
      b => b.issueNumber === issueNumber && b.status === 'OPEN'
    );
    if (!bounty) {
      throw new NotFoundException(`No open bounty found for issue #${issueNumber}`);
    }

    bounty.status = 'CLAIMED';
    bounty.claimedBy = claimerUsername;

    return bounty;
  }
}
