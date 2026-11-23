import { Module } from '@nestjs/common';
import { ChaosRunnerService } from './chaos-runner.service';
import { EtcdConfigService } from './etcd-config.service';
import { ActiveActiveReplicatorService } from './active-active-replicator.service';
import { DataArchiverService } from './data-archiver.service';
import { ShardRebalancerService } from './shard-rebalancer.service';
import { IndexAdvisorService } from './index-advisor.service';

@Module({
  providers: [
    ChaosRunnerService,
    EtcdConfigService,
    ActiveActiveReplicatorService,
    DataArchiverService,
    ShardRebalancerService,
    IndexAdvisorService,
  ],
  exports: [
    ChaosRunnerService,
    EtcdConfigService,
    ActiveActiveReplicatorService,
    DataArchiverService,
    ShardRebalancerService,
    IndexAdvisorService,
  ],
})
export class OpsModule {}
