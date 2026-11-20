import { Module } from '@nestjs/common';
import { SpatialAudioService } from './spatial-audio.service';
import { VadSignalingGateway } from './vad-signaling.gateway';

@Module({
  providers: [SpatialAudioService, VadSignalingGateway],
  exports: [SpatialAudioService],
})
export class AudioModule {}

