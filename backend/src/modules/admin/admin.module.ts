import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditLogService } from './audit-log.service';
import { SecurityModule } from '../security/security.module';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SecurityModule, StorageModule, AuthModule],
  controllers: [AdminController],
  providers: [AdminService, AuditLogService],
  exports: [AdminService, AuditLogService],
})
export class AdminModule {}
