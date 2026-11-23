import { Module } from '@nestjs/common';
import { ChaosRunnerService } from './chaos-runner.service';
import { EtcdConfigService } from './etcd-config.service';
import { ActiveActiveReplicatorService } from './active-active-replicator.service';

@Module({
  providers: [ChaosRunnerService, EtcdConfigService, ActiveActiveReplicatorService],
  exports: [ChaosRunnerService, EtcdConfigService, ActiveActiveReplicatorService],

import { SpotBidderService } from './spot-bidder.service';
  providers: [SpotBidderService, ChaosRunnerService, EtcdConfigService],
  exports: [SpotBidderService, ChaosRunnerService, EtcdConfigService],

import { FailoverGatewayService } from './failover-gateway.service';
  providers: [ChaosRunnerService, EtcdConfigService, FailoverGatewayService],
  exports: [ChaosRunnerService, EtcdConfigService, FailoverGatewayService],
})
export class OpsModule {}
