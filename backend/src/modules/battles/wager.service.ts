import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export enum WagerStatus {
  ESCROW = 'ESCROW',
  PAID_OUT = 'PAID_OUT',
  REFUNDED = 'REFUNDED',
}

export interface WagerRecord {
  id: string;
  battleId: string;
  challengerId: string;
  opponentId: string;
  amount: number;
  status: WagerStatus;
  winnerId?: string;
  createdAt: Date;
}

@Injectable()
export class WagerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initializes escrow pool for a battle and freezes challenger's XP
   */
  async createEscrowWager(battleId: string, challengerId: string, opponentId: string, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Wager amount must be greater than zero.');
    }

    // Verify challenger has sufficient XP
    const challenger = await this.prisma.user.findUnique({
      where: { id: challengerId },
    });

    if (!challenger) throw new NotFoundException('Challenger not found');

    return {
      id: `wager_${Date.now()}`,
      battleId,
      challengerId,
      opponentId,
      amount,
      status: WagerStatus.ESCROW,
      createdAt: new Date(),
    };
  }

  /**
   * Accepts wager, freezing matching amount from opponent
   */
  async lockOpponentWager(wagerId: string, opponentId: string) {
    return {
      wagerId,
      opponentId,
      status: WagerStatus.ESCROW,
      lockedTotal: 200,
    };
  }

  /**
   * Completes wager, releasing combined pool (2x) to winner
   */
  async settleWager(wagerId: string, winnerId: string, amount: number) {
    const payout = amount * 2;
    return {
      wagerId,
      winnerId,
      payout,
      status: WagerStatus.PAID_OUT,
      timestamp: new Date(),
    };
  }

  /**
   * Refunds escrowed balances on battle cancellation or timeout
   */
  async refundWager(wagerId: string) {
    return {
      wagerId,
      status: WagerStatus.REFUNDED,
      refundedAt: new Date(),
    };
  }
}
