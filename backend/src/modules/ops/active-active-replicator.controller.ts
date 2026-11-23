import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ActiveActiveReplicatorService } from './active-active-replicator.service';
import type {
  CloudRegionId,
  MultiCloudSyncMetrics,
  ReplicationBatch,
} from './active-active-replicator.types';
import { SyncJournalService } from './sync-journal.service';

@Controller('ops/replication')
export class ActiveActiveReplicatorController {
  constructor(
    private readonly replicator: ActiveActiveReplicatorService,
    private readonly journal: SyncJournalService,
  ) {}

  @Get('metrics')
  public getMetrics(): MultiCloudSyncMetrics {
    return this.journal.getMetrics();
  }

  @Get('batch/:targetRegion')
  public getPendingBatch(
    @Param('targetRegion') targetRegion: CloudRegionId,
  ): ReplicationBatch {
    return this.journal.getReplicationBatch(targetRegion);
  }

  @Post('ingest-batch')
  @HttpCode(HttpStatus.OK)
  public ingestBatch(
    @Body() batch: ReplicationBatch,
  ): { ingested: number; conflicts: number } {
    return this.replicator.replicateBatch(batch);
  }

  @Post('acknowledge')
  @HttpCode(HttpStatus.OK)
  public acknowledgeLsn(
    @Body() body: { region: CloudRegionId; lsn: string },
  ): { acknowledged: boolean } {
    this.journal.acknowledgeLsn(body.region, BigInt(body.lsn));
    return { acknowledged: true };
  }

  @Post('reconnect-replay/:targetRegion')
  @HttpCode(HttpStatus.OK)
  public replayReconnect(
    @Param('targetRegion') targetRegion: CloudRegionId,
  ): ReplicationBatch {
    return this.journal.replayForReconnect(targetRegion);
  }
}
