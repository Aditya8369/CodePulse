import { Global, Module } from '@nestjs/common';
import { AcmeCertService } from './acme-cert.service';
import { TlsReloaderService } from '../../common/services/tls-reloader.service';
import { VaultService } from './vault.service';
import { PowService } from './pow.service';
import { PowController } from './pow.controller';
import { PowChallengeGuard } from '../../common/guards/pow-challenge.guard';

@Global()
@Module({
  controllers: [PowController],
  providers: [
    AcmeCertService,
    TlsReloaderService,
    VaultService,
    PowService,
    PowChallengeGuard,
  ],
  exports: [
    AcmeCertService,
    TlsReloaderService,
    VaultService,
    PowService,
    PowChallengeGuard,
  ],
})
export class SecurityModule {}
