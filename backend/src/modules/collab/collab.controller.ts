import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { VectorClockService } from './vector-clock.service';
import {
  VectorClock,
  ConflictResolutionStrategy,
  ThreeWayMergeResult,
  ReplicaCausalityReport,
} from './vector-clock.types';

export interface ReconcileRequestDto {
  baseText: string;
  localText: string;
  remoteText: string;
  baseClock: VectorClock;
  localClock: VectorClock;
  remoteClock: VectorClock;
  strategy?: ConflictResolutionStrategy;
}

export interface CausalityReportRequestDto {
  replicaClocks: Record<string, VectorClock>;
}

@Controller('collab/vector-clocks')
export class CollabVectorClockController {
  constructor(private readonly vectorClockService: VectorClockService) {}

  @Get(':documentId')
  public getDocumentClock(@Param('documentId') documentId: string): {
    documentId: string;
    clock: VectorClock;
  } {
    const clock = this.vectorClockService.getClock(documentId);
    return { documentId, clock };
  }

  @Post(':documentId/tick')
  public tick(
    @Param('documentId') documentId: string,
    @Body('nodeId') nodeId: string
  ): { documentId: string; clock: VectorClock } {
    const clock = this.vectorClockService.tick(documentId, nodeId);
    return { documentId, clock };
  }

  @Post(':documentId/merge')
  public merge(
    @Param('documentId') documentId: string,
    @Body('remoteClock') remoteClock: VectorClock
  ): { documentId: string; clock: VectorClock } {
    const clock = this.vectorClockService.merge(documentId, remoteClock);
    return { documentId, clock };
  }

  @Post('compare')
  public compareClocks(
    @Body('clockA') clockA: VectorClock,
    @Body('clockB') clockB: VectorClock
  ): { relation: string; isConcurrent: boolean; divergenceDistance: number } {
    const relation = VectorClockService.compare(clockA, clockB);
    const divergenceDistance = VectorClockService.divergenceDistance(clockA, clockB);
    return {
      relation,
      isConcurrent: relation === 'CONCURRENT',
      divergenceDistance,
    };
  }

  @Post('reconcile')
  public reconcileThreeWay(
    @Body() dto: ReconcileRequestDto
  ): ThreeWayMergeResult {
    return this.vectorClockService.reconcileThreeWay(
      dto.baseText,
      dto.localText,
      dto.remoteText,
      dto.baseClock,
      dto.localClock,
      dto.remoteClock,
      dto.strategy ?? 'AST_THREE_WAY'
    );
  }

  @Post(':documentId/causality-report')
  public generateReport(
    @Param('documentId') documentId: string,
    @Body() dto: CausalityReportRequestDto
  ): ReplicaCausalityReport {
    return this.vectorClockService.generateCausalityReport(
      documentId,
      dto.replicaClocks
    );
  }
}
