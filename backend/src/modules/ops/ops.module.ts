import { Module } from '@nestjs/common';
import { ChaosRunnerService } from './chaos-runner.service';
import { EtcdConfigService } from './etcd-config.service';
import { FailoverGatewayService } from './failover-gateway.service';

@Module({
  providers: [ChaosRunnerService, EtcdConfigService, FailoverGatewayService],
  exports: [ChaosRunnerService, EtcdConfigService, FailoverGatewayService],
})
export class OpsModule {}
