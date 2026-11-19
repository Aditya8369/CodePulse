import { Module } from '@nestjs/common';
import { EsportsController } from './esports.controller';
import { VideoHighlightService } from './video-highlight.service';

@Module({
  controllers: [EsportsController],
  providers: [VideoHighlightService],
  exports: [VideoHighlightService],
})
export class EsportsModule {}
