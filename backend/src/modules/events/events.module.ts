import { Module } from '@nestjs/common';
import { EventStoreService } from './event-store.service';
import { BattleReadProjection } from './projections/battle-read.projection';
import { EloReadProjection } from './projections/elo-read.projection';
import { CdcDispatcherService } from './cdc-dispatcher.service';
import { RedisService } from '../../common/redis/redis.service';
import { StickyAssignorService } from './sticky-assignor.service';
import { PartitionRebalanceManagerService } from './partition-rebalance-manager.service';
import { CompensationRunnerService } from './compensation-runner.service';
import { SagaOrchestratorService } from './saga-orchestrator.service';
import { ProtobufCompatibilityService } from './protobuf-compatibility.service';
import { SchemaRegistryService } from './schema-registry.service';

@Module({
  providers: [
    EventStoreService,
    BattleReadProjection,
    EloReadProjection,
    CdcDispatcherService,
    RedisService,
    StickyAssignorService,
    PartitionRebalanceManagerService,
    CompensationRunnerService,
    SagaOrchestratorService,
    ProtobufCompatibilityService,
    SchemaRegistryService,
  ],
  exports: [
    EventStoreService,
    BattleReadProjection,
    EloReadProjection,
    CdcDispatcherService,
    StickyAssignorService,
    PartitionRebalanceManagerService,
    CompensationRunnerService,
    SagaOrchestratorService,
    ProtobufCompatibilityService,
    SchemaRegistryService,
  ],
})
export class EventsModule {}
