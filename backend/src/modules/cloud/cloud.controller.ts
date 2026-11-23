import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  FinOpsReaperService,
  type CloudAuditedResource,
  type FinOpsAuditSummary,
} from './finops-reaper.service';

@ApiTags('admin')
@Controller('admin/finops')
export class CloudController {
  constructor(private readonly finOpsReaper: FinOpsReaperService) {}

  @Get('ledger')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve persisted FinOps automated reaper savings ledger' })
  getSavingsLedger() {
    return {
      overnightWindowActive: this.finOpsReaper.isOvernightSleepWindow(),
      entries: this.finOpsReaper.getLedgerEntries(),
    };
  }

  @Post('audit')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Audit AWS, GCP, and Render resources and reap idle non-production assets',
  })
  async runMultiCloudAudit(
    @Body() body: { resources?: CloudAuditedResource[] },
  ): Promise<FinOpsAuditSummary> {
    return this.finOpsReaper.auditAndReapResources({
      resources: body?.resources ?? [],
    });
  }
}
