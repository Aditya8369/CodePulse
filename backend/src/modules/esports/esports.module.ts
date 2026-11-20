import { Module } from '@nestjs/common';
import { EsportsController } from './esports.controller';
import { VideoHighlightService } from './video-highlight.service';
import { CasterStudioService } from './caster-studio.service';
import { CasterStudioGateway } from './caster-studio.gateway';
import { AiShoutcasterService } from './ai-shoutcaster.service';

@Module({
  controllers: [EsportsController],
  providers: [
    VideoHighlightService,
    CasterStudioService,
    CasterStudioGateway,
    AiShoutcasterService,
  ],
  exports: [
    VideoHighlightService,
    CasterStudioService,
    AiShoutcasterService,
  ],
})
export class EsportsModule {}
