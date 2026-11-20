import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  PredictionMarketCategory,
  PredictionMarketService,
} from './prediction-market.service';

@Controller('esports/predictions')
export class EsportsController {
  constructor(private readonly predictionMarket: PredictionMarketService) {}

  @Post('pools')
  createPool(
    @Body()
    body: {
      battleId: string;
      category?: PredictionMarketCategory;
      title?: string;
      outcomes: Record<string, string>;
    },
  ) {
    return this.predictionMarket.createPredictionPool(body);
  }

  @Get('pools/:battleId')
  getPool(@Param('battleId') battleId: string) {
    return this.predictionMarket.enforceSpoilerLockIfExpired(battleId);
  }

  @Get('wallets/:userId')
  getWallet(@Param('userId') userId: string) {
    return {
      userId,
      currency: 'PulseBits',
      balance: this.predictionMarket.getWalletBalance(userId),
      realWorldMonetaryValue: 0,
    };
  }

  @Post('wagers')
  placeWager(
    @Body()
    body: {
      battleId: string;
      userId: string;
      outcomeKey: string;
      stakeBits: number;
    },
  ) {
    return this.predictionMarket.placePrediction(body);
  }

  @Post('pools/:battleId/resolve')
  resolvePool(
    @Param('battleId') battleId: string,
    @Body() body: { winningOutcome: string; verifiedByJudge: boolean },
  ) {
    return this.predictionMarket.resolveMarket({
      battleId,
      winningOutcome: body.winningOutcome,
      verifiedByJudge: body.verifiedByJudge,
    });
  }
}
