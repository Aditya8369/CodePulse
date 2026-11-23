import { Module, forwardRef } from '@nestjs/common';
import { BattlesGateway } from './battles.gateway';
import { BattlesService } from './battles.service';
import { BattlesController } from './battles.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CodeSandboxService } from './code-sandbox.service';
import { RedisModule } from '../../redis/redis.module';
import { BattleMetricsService } from './battle-metrics.service';
import { BattlePersistenceQueue } from './battle-persistence.queue';
import { BattleSnapshotQueue } from './battle-snapshot.queue';
import { BattleReplayService } from './battle-replay.service';
import { BattleSabotageService } from './battle-sabotage.service';
import { BattleSabotageController } from './battle-sabotage.controller';
import { BattleMatchmakingService } from './battle-matchmaking.service';
import { BattleTournamentService } from './battle-tournament.service';
import { TournamentEngineService } from './tournament-engine.service';
import { AntiSmurfService } from './anti-smurf.service';
import { WatermarkService } from './watermark.service';
import { ReplayStreamService } from './replay-stream.service';
import { RaidBossService } from './raid-boss.service';
import { BattleStatsService } from './battle-stats.service';
import { MatchmakingQueueService } from './matchmaking-queue.service';
import { EdgeRelayService } from './edge-relay.service';
import { PlagiarismService } from './plagiarism.service';
import { RoomService } from './room.service';
import { EvaluatorService } from './evaluator.service';
import { RaftStateService } from './consensus/raft-state.service';
import { WalLogService } from './consensus/wal-log.service';
import { CrdtRelayGateway } from './crdt-relay.gateway';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    RedisModule,
  ],
  controllers: [
    BattlesController,
    BattleSabotageController,
  ],
  providers: [
    BattlesGateway,
    BattlesService,
    CodeSandboxService,
    BattleMetricsService,
    BattlePersistenceQueue,
    BattleSnapshotQueue,
    BattleReplayService,
    BattleSabotageService,
    BattleMatchmakingService,
    BattleTournamentService,
    TournamentEngineService,
    AntiSmurfService,
    WatermarkService,
    ReplayStreamService,
    RaidBossService,
    BattleStatsService,
    MatchmakingQueueService,
    EdgeRelayService,
    PlagiarismService,
    RoomService,
    EvaluatorService,
    RaftStateService,
    WalLogService,
    CrdtRelayGateway,
  ],
  exports: [
    BattlesService,
    BattlesGateway,
    BattleMatchmakingService,
    BattleTournamentService,
    TournamentEngineService,
    AntiSmurfService,
    WatermarkService,
    ReplayStreamService,
    RaidBossService,
    BattleStatsService,
    MatchmakingQueueService,
    EdgeRelayService,
    PlagiarismService,
    RoomService,
    EvaluatorService,
    RaftStateService,
    WalLogService,
    CrdtRelayGateway,
  ],
})
export class BattlesModule {}
