import {
  Controller,
  Get,
  Param,
  Res,
  Headers,
  HttpStatus,
  Post,
  Body,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import type { Response } from 'express';
import { MmapStorageService } from './mmap-storage.service';
import type { MmapEngineStats } from './mmap-storage.service';
import { RocksDbService } from './rocksdb.service';
import type { RocksDbStats } from './rocksdb.service';
import { WorkspaceStateService } from './workspace-state.service';
import type { UnsavedDraftState } from './workspace-state.service';

@ApiTags('storage')
@Controller('storage')
export class StorageController {
  constructor(
    private readonly mmapStorage: MmapStorageService,
    private readonly rocksDb: RocksDbService,
    private readonly workspaceState: WorkspaceStateService,
  ) {}

  @Get('rocksdb/stats')
  @ApiOperation({
    summary: 'Get embedded RocksDB LSM-Tree key-value store metrics',
  })
  getRocksDbStats(): RocksDbStats {
    return this.rocksDb.getStats();
  }

  @Post('workspace/draft')
  @ApiOperation({
    summary: 'Save transient unsaved editor draft with microsecond write latency in RocksDB',
  })
  @ApiBody({ description: 'Editor draft payload' })
  async saveDraft(@Body() draft: UnsavedDraftState) {
    await this.workspaceState.saveDraft(draft);
    return { success: true, key: this.workspaceState.getWorkspaceKey(draft.userId, draft.fileId) };
  }

  @Get('workspace/draft/:userId/:fileId')
  @ApiOperation({
    summary: 'Retrieve transient unsaved editor draft from RocksDB',
  })
  @ApiParam({ name: 'userId' })
  @ApiParam({ name: 'fileId' })
  async getDraft(
    @Param('userId') userId: string,
    @Param('fileId') fileId: string,
  ) {
    const draft = await this.workspaceState.getDraft(userId, fileId);
    return { success: true, draft };
  }

  @Post('workspace/flush')
  @ApiOperation({
    summary: 'Flush finalized code drafts to persistent store and prune RocksDB state upon commit',
  })
  async flushDrafts(
    @Body('userId') userId: string,
    @Body('fileIds') fileIds: string[],
    @Body('commitSha') commitSha?: string,
  ) {
    return this.workspaceState.flushCommittedDrafts(userId, fileIds, commitSha);
  }

  @Get('monaco/stats')
  @ApiOperation({
    summary: 'Get Memory-Mapped File (mmap) Storage Engine zero-copy performance metrics',
  })
  getStats(): MmapEngineStats {
    return this.mmapStorage.getStats();
  }

  @Post('monaco/reload/*assetKey')
  @ApiOperation({
    summary: 'Hot-reload and remap a Monaco asset into virtual memory without restart',
  })
  @ApiParam({ name: 'assetKey', description: 'Relative path of the Monaco asset' })
  hotReload(@Param('assetKey') rawKey: string | string[]) {
    const assetKey = Array.isArray(rawKey) ? rawKey.join('/') : rawKey;
    const remapped = this.mmapStorage.hotReloadAsset(assetKey);
    return {
      success: true,
      assetKey: remapped.metadata.assetKey,
      sizeBytes: remapped.metadata.sizeBytes,
      etag: remapped.metadata.etag,
      mappedAt: remapped.metadata.mappedAt,
    };
  }

  @Get('monaco/*assetKey')
  @ApiOperation({
    summary:
      'Serve Monaco WebWorker bundles and language grammars directly from OS memory-mapped virtual memory (Zero-Copy)',
  })
  @ApiParam({ name: 'assetKey', description: 'Relative path of the Monaco asset bundle' })
  @ApiResponse({ status: 200, description: 'Direct zero-copy memory stream' })
  @ApiResponse({ status: 304, description: 'Not Modified (ETag matched in cache)' })
  serveAsset(
    @Param('assetKey') rawKey: string | string[],
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res() res: Response,
  ) {
    const assetKey = Array.isArray(rawKey) ? rawKey.join('/') : rawKey;
    const { buffer, metadata } = this.mmapStorage.getMemoryMappedAsset(assetKey);

    // Fast 304 check without buffer copy
    if (ifNoneMatch && ifNoneMatch === metadata.etag) {
      res.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }

    res.set({
      'Content-Type': metadata.contentType,
      'Content-Length': metadata.sizeBytes.toString(),
      'ETag': metadata.etag,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Storage-Engine': 'Memory-Mapped-File-ZeroCopy',
      'X-Virtual-Memory-Pages': metadata.pageCount.toString(),
    });

    // Zero-copy transfer: sends the memory-mapped buffer straight to kernel socket
    res.status(HttpStatus.OK).end(buffer);
  }
}

