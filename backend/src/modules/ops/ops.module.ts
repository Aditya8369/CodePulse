import { Module } from '@nestjs/common';
import { ChaosRunnerService } from './chaos-runner.service';
import { EtcdConfigService } from './etcd-config.service';
import { ActiveActiveReplicatorService } from './active-active-replicator.service';
import { DataArchiverService } from './data-archiver.service';

@Module({
  providers: [ChaosRunnerService, EtcdConfigService, ActiveActiveReplicatorService, DataArchiverService],
  exports: [ChaosRunnerService, EtcdConfigService, ActiveActiveReplicatorService, DataArchiverService],
})
export class OpsModule {}
