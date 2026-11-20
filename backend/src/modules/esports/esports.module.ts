import { Module } from '@nestjs/common';
import { EsportsController } from './esports.controller';
import { VideoHighlightService } from './video-highlight.service';
import { CasterStudioService } from './caster-studio.service';
import { CasterStudioGateway } from './caster-studio.gateway';
import { AiShoutcasterService } from './ai-shoutcaster.service';
import { PredictionMarketService } from './prediction-market.service';

@Module({
  controllers: [EsportsController],
  providers: [
    VideoHighlightService,
    CasterStudioService,
    CasterStudioGateway,
    AiShoutcasterService,
    PredictionMarketService,
  ],
  exports: [
    VideoHighlightService,
    CasterStudioService,
    AiShoutcasterService,
    PredictionMarketService,
  ],
})
export class EsportsModule {}
