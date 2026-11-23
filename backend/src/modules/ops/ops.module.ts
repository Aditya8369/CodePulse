import { Module } from '@nestjs/common';
import { ChaosRunnerService } from './chaos-runner.service';
import { EtcdConfigService } from './etcd-config.service';
import { ActiveActiveReplicatorService } from './active-active-replicator.service';
import { SpotBidderService } from './spot-bidder.service';
import { FailoverGatewayService } from './failover-gateway.service';

import { DataArchiverService } from './data-archiver.service';
import { ShardRebalancerService } from './shard-rebalancer.service';

import { IndexAdvisorService } from './index-advisor.service';

@Module({
  providers: [
    ChaosRunnerService,
    EtcdConfigService,
    ActiveActiveReplicatorService,
    SpotBidderService,
    FailoverGatewayService,

    DataArchiverService,
    ShardRebalancerService,

    IndexAdvisorService,
  ],
  exports: [
    ChaosRunnerService,
    EtcdConfigService,
    ActiveActiveReplicatorService,
    SpotBidderService,
    FailoverGatewayService,
  ],

import { DataArchiverService } from './data-archiver.service';
  providers: [ChaosRunnerService, EtcdConfigService, ActiveActiveReplicatorService, DataArchiverService],
  exports: [ChaosRunnerService, EtcdConfigService, ActiveActiveReplicatorService, DataArchiverService],

    DataArchiverService,
    ShardRebalancerService,

    IndexAdvisorService,
})
export class OpsModule {}
