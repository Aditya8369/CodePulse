import { Global, Module } from '@nestjs/common';
import { AcmeCertService } from './acme-cert.service';
import { TlsReloaderService } from '../../common/services/tls-reloader.service';
import { VaultService } from './vault.service';
import { PowService } from './pow.service';
import { PowController } from './pow.controller';
import { PowChallengeGuard } from '../../common/guards/pow-challenge.guard';
import { ThreatDetectorService } from './threat-detector.service';
import { ThreatMonitorInterceptor } from '../../common/interceptors/threat-monitor.interceptor';
import {
  MtlsMeshService,
  MtlsVerificationMiddleware,
} from '../../common/security/mtls.config';

@Global()
@Module({
  controllers: [PowController],
  providers: [
    AcmeCertService,
    TlsReloaderService,
    VaultService,
    PowService,
    PowChallengeGuard,
    ThreatDetectorService,
    ThreatMonitorInterceptor,
    MtlsMeshService,
    MtlsVerificationMiddleware,
  ],
  exports: [
    AcmeCertService,
    TlsReloaderService,
    VaultService,
    PowService,
    PowChallengeGuard,
    ThreatDetectorService,
    ThreatMonitorInterceptor,
    MtlsMeshService,
    MtlsVerificationMiddleware,
  ],
})
export class SecurityModule {}
