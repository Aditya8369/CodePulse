import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ChandyLamportService } from './chandy-lamport.service';
import { ArenaMarkerMessage, GlobalArenaSnapshot, SnapshotMetrics } from './chandy-lamport.types';

@Controller('battles/snapshot')
export class ChandyLamportController {
  constructor(private readonly snapshotService: ChandyLamportService) {}

  @Get('metrics')
  public getMetrics(): SnapshotMetrics {
    return this.snapshotService.getMetrics();
  }

  @Get(':snapshotId')
  public getSnapshot(@Param('snapshotId') id: string): GlobalArenaSnapshot | { error: string } {
    const snap = this.snapshotService.getSnapshot(id);
    return snap ?? { error: 'Snapshot not found' };
  }

  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  public initiate(@Body() body: { snapshotId?: string }): GlobalArenaSnapshot {
    return this.snapshotService.initiateSnapshot(body.snapshotId);
  }

  @Post('marker')
  @HttpCode(HttpStatus.OK)
  public handleMarker(@Body() marker: ArenaMarkerMessage): { firstMarker: boolean; propagatedCount: number } {
    const res = this.snapshotService.handleMarker(marker);
    return {
      firstMarker: res.firstMarker,
      propagatedCount: res.markersToPropagate.length,
    };
  }
}
