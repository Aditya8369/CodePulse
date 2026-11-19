import { Module } from '@nestjs/common';
import { AiShoutcasterService } from './ai-shoutcaster.service';

@Module({
  providers: [AiShoutcasterService],
  exports: [AiShoutcasterService],
})
export class EsportsModule {}
