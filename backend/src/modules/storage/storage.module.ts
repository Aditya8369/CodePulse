import { Module } from '@nestjs/common';
import { MmapStorageService } from './mmap-storage.service';
import { MmapAssetsService } from './mmap-assets.service';
import { RocksDbService } from './rocksdb.service';
import { WorkspaceStateService } from './workspace-state.service';
import { HsmService } from './hsm.service';
import { HsmArchivalService } from './hsm-archival.service';
import { StorageController } from './storage.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StorageController],
  providers: [
    MmapStorageService,
    MmapAssetsService,
    RocksDbService,
    WorkspaceStateService,
    HsmService,
    HsmArchivalService,
  ],
  exports: [
    MmapStorageService,
    MmapAssetsService,
    RocksDbService,
    WorkspaceStateService,
    HsmService,
    HsmArchivalService,
  ],
})
export class StorageModule {}


