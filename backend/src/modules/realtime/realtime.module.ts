import { Module } from '@nestjs/common';
import { CdcService } from './cdc.service';
import { PulseController } from './pulse.controller';
import { QuicGateway } from './quic-gateway';

@Module({
  controllers: [PulseController],
  providers: [CdcService, QuicGateway],
  exports: [CdcService, QuicGateway],
})
export class RealtimeModule {}
