import { Module } from '@nestjs/common';
import { MmapStorageService } from './mmap-storage.service';
import { HsmService } from './hsm.service';
import { StorageController } from './storage.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StorageController],
  providers: [MmapStorageService, HsmService],
  exports: [MmapStorageService, HsmService],
})
export class StorageModule {}

