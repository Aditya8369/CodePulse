import { Module } from '@nestjs/common';
import { ZkpVerifierService } from './zkp-verifier.service';
import { HomomorphicTelemetryService } from './homomorphic-telemetry.service';
import { ZkSnarkVerifierService } from './zk-snark-verifier.service';
import { CryptoController } from './crypto.controller';
import { PostQuantumService } from './post-quantum.service';
import { CryptoMpcVaultService } from './mpc-vault.service';

@Module({
  controllers: [CryptoController],
  providers: [
    ZkpVerifierService,
    HomomorphicTelemetryService,
    ZkSnarkVerifierService,
    PostQuantumService,
    CryptoMpcVaultService,
  ],
  exports: [
    ZkpVerifierService,
    HomomorphicTelemetryService,
    ZkSnarkVerifierService,
    PostQuantumService,
    CryptoMpcVaultService,
  ],
})
export class CryptoModule {}
