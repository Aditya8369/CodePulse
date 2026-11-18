import { Module } from '@nestjs/common';
import { ZkpVerifierService } from './zkp-verifier.service';
import { CryptoController } from './crypto.controller';

@Module({
  controllers: [CryptoController],
  providers: [ZkpVerifierService],
  exports: [ZkpVerifierService],
})
export class CryptoModule {}

