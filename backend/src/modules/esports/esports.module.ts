import { Module } from '@nestjs/common';
import { CasterStudioService } from './caster-studio.service';
import { CasterStudioGateway } from './caster-studio.gateway';

@Module({
  providers: [CasterStudioService, CasterStudioGateway],
  exports: [CasterStudioService],
})
export class EsportsModule {}

