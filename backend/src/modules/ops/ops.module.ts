import { Module } from '@nestjs/common';
import { ChaosRunnerService } from './chaos-runner.service';
import { EtcdConfigService } from './etcd-config.service';
import { ActiveActiveReplicatorService } from './active-active-replicator.service';
import { SpotBidderService } from './spot-bidder.service';
import { FailoverGatewayService } from './failover-gateway.service';
import { DataArchiverService } from './data-archiver.service';
import { ShardRebalancerService } from './shard-rebalancer.service';
import { IndexAdvisorService } from './index-advisor.service';
import { CostAttributionService } from './cost-attribution.service';

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
    CostAttributionService,
  ],
  exports: [
    ChaosRunnerService,
    EtcdConfigService,
    ActiveActiveReplicatorService,
    SpotBidderService,
    FailoverGatewayService,
    DataArchiverService,
    ShardRebalancerService,
    IndexAdvisorService,
    CostAttributionService,
  ],
})
export class OpsModule {}
