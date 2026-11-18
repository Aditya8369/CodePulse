import { Module } from '@nestjs/common';
import { MmapStorageService } from './mmap-storage.service';
import { StorageController } from './storage.controller';

@Module({
  controllers: [StorageController],
  providers: [MmapStorageService],
  exports: [MmapStorageService],
})
export class StorageModule {}

