import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
  Optional,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { VideoHighlightService } from './video-highlight.service';
import { GenerateHighlightDto, HighlightMetadata } from './dto/video-highlight.dto';
import {
  PredictionMarketCategory,
  PredictionMarketService,
} from './prediction-market.service';

@ApiTags('esports')
@Controller('esports')
export class EsportsController {
  constructor(
    @Optional() private readonly highlightService?: VideoHighlightService,
    @Optional() private readonly predictionMarket?: PredictionMarketService,
  ) {}

  @Post('highlights/generate')
  @ApiOperation({
    summary: 'Generate an automated 15-second clutch video highlight clip for a battle',
  })
  @ApiResponse({ status: 201, description: 'Highlight generated successfully' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async generateHighlight(@Body() dto: GenerateHighlightDto): Promise<HighlightMetadata> {
    if (!this.highlightService) throw new Error('Highlight service not configured');
    return this.highlightService.generateVideoHighlight(dto.battleId, dto.format);
  }

  @Get('highlights/:id')
  @ApiOperation({
    summary: 'Retrieve video highlight metadata and Open Graph tags by highlight ID',
  })
  @ApiResponse({ status: 200, description: 'Highlight metadata found' })
  @ApiResponse({ status: 404, description: 'Highlight not found' })
  async getHighlight(@Param('id') id: string): Promise<HighlightMetadata> {
    if (!this.highlightService) throw new Error('Highlight service not configured');
    return this.highlightService.getHighlightById(id);
  }

  @Post('predictions/pools')
  createPool(
    @Body()
    body: {
      battleId: string;
      category?: PredictionMarketCategory;
      title?: string;
      outcomes: Record<string, string>;
    },
  ) {
    if (!this.predictionMarket) throw new Error('Prediction market service not configured');
    return this.predictionMarket.createPredictionPool(body);
  }

  @Get('predictions/pools/:battleId')
  getPool(@Param('battleId') battleId: string) {
    if (!this.predictionMarket) throw new Error('Prediction market service not configured');
    return this.predictionMarket.enforceSpoilerLockIfExpired(battleId);
  }

  @Get('predictions/wallets/:userId')
  getWallet(@Param('userId') userId: string) {
    if (!this.predictionMarket) throw new Error('Prediction market service not configured');
    return {
      userId,
      currency: 'PulseBits',
      balance: this.predictionMarket.getWalletBalance(userId),
      realWorldMonetaryValue: 0,
    };
  }

  @Post('predictions/wagers')
  placeWager(
    @Body()
    body: {
      battleId: string;
      userId: string;
      outcomeKey: string;
      stakeBits: number;
    },
  ) {
    if (!this.predictionMarket) throw new Error('Prediction market service not configured');
    return this.predictionMarket.placePrediction(body);
  }

  @Post('predictions/pools/:battleId/resolve')
  resolvePool(
    @Param('battleId') battleId: string,
    @Body() body: { winningOutcome: string; verifiedByJudge: boolean },
  ) {
    if (!this.predictionMarket) throw new Error('Prediction market service not configured');
    return this.predictionMarket.resolveMarket({
      battleId,
      winningOutcome: body.winningOutcome,
      verifiedByJudge: body.verifiedByJudge,
    });
  }
}
