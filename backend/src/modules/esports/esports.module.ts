import { Module } from '@nestjs/common';
import { EsportsController } from './esports.controller';
import { VideoHighlightService } from './video-highlight.service';
import { CasterStudioService } from './caster-studio.service';
import { CasterStudioGateway } from './caster-studio.gateway';
import { AiShoutcasterService } from './ai-shoutcaster.service';
import { PredictionMarketService } from './prediction-market.service';
import { DisputeService } from './dispute.service';
import { DisputeController } from './dispute.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [PrismaModule, AnalyticsModule],
  controllers: [EsportsController, DisputeController],
  providers: [
    VideoHighlightService,
    CasterStudioService,
    CasterStudioGateway,
    AiShoutcasterService,
    PredictionMarketService,
    DisputeService,
  ],
  exports: [
    VideoHighlightService,
    CasterStudioService,
    AiShoutcasterService,
    PredictionMarketService,
    DisputeService,
  ],
})
export class EsportsModule {}
