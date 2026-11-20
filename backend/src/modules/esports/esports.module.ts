import { Module } from '@nestjs/common';
import { PredictionMarketService } from './prediction-market.service';
import { EsportsController } from './esports.controller';

@Module({
  controllers: [EsportsController],
  providers: [PredictionMarketService],
  exports: [PredictionMarketService],
})
export class EsportsModule {}
