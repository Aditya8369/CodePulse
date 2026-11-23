import { Module } from '@nestjs/common';
import { ResourceReaperService } from './resource-reaper.service';
import { CloudCostController } from './cloud-cost.controller';
import { FinOpsReaperService } from './finops-reaper.service';
import { CloudController } from './cloud.controller';

@Module({
  controllers: [CloudCostController, CloudController],
  providers: [ResourceReaperService, FinOpsReaperService],
  exports: [ResourceReaperService, FinOpsReaperService],
})
export class CloudModule {}
