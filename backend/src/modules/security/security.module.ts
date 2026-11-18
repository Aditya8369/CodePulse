import { Module } from '@nestjs/common';
import { AcmeCertService } from './acme-cert.service';
import { TlsReloaderService } from '../../common/services/tls-reloader.service';
import { VaultService } from './vault.service';

@Module({
  providers: [AcmeCertService, TlsReloaderService, VaultService],
  exports: [AcmeCertService, TlsReloaderService, VaultService],
})
export class SecurityModule {}
