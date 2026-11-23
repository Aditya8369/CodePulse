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
})
export class OpsModule {}
