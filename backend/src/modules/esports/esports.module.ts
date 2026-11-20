import { Module } from '@nestjs/common';
import { EsportsController } from './esports.controller';
import { VideoHighlightService } from './video-highlight.service';
import { CasterStudioService } from './caster-studio.service';
import { CasterStudioGateway } from './caster-studio.gateway';

@Module({
  controllers: [EsportsController],
  providers: [VideoHighlightService, CasterStudioService, CasterStudioGateway],
  exports: [VideoHighlightService, CasterStudioService],
})
export class EsportsModule {}
