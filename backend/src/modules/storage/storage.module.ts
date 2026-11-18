import { Module } from '@nestjs/common';
import { MmapStorageService } from './mmap-storage.service';
import { RocksDbService } from './rocksdb.service';
import { WorkspaceStateService } from './workspace-state.service';
import { HsmService } from './hsm.service';
import { StorageController } from './storage.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StorageController],
  providers: [MmapStorageService, RocksDbService, WorkspaceStateService, HsmService],
  exports: [MmapStorageService, RocksDbService, WorkspaceStateService, HsmService],
})
export class StorageModule {}

