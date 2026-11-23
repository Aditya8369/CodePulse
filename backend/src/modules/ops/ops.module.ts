import { Module } from '@nestjs/common';
import { ChaosRunnerService } from './chaos-runner.service';
import { EtcdConfigService } from './etcd-config.service';
import { ActiveActiveReplicatorService } from './active-active-replicator.service';
import { SpotBidderService } from './spot-bidder.service';
import { FailoverGatewayService } from './failover-gateway.service';

@Module({
  providers: [
    ChaosRunnerService,
    EtcdConfigService,
    ActiveActiveReplicatorService,
    SpotBidderService,
    FailoverGatewayService,
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
})
export class OpsModule {}
