import { Module } from '@nestjs/common';
import { SpotBidderService } from './spot-bidder.service';
import { ChaosRunnerService } from './chaos-runner.service';
import { EtcdConfigService } from './etcd-config.service';

@Module({
  providers: [SpotBidderService, ChaosRunnerService, EtcdConfigService],
  exports: [SpotBidderService, ChaosRunnerService, EtcdConfigService],
})
export class OpsModule {}
