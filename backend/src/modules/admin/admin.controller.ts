import {
  Controller,
  Delete,
  Post,
  Put,
  Get,
  Param,
  Body,
  Query,
  Optional,
  BadRequestException,
  NotFoundException,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AuditLogService } from './audit-log.service';
import { AuditLogQueryDto } from './dto/audit-log.dto';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import {
  DynamicConfigService,
  DynamicConfigKey,
} from '../../config/dynamic-config.service';
import { AcmeCertService } from '../security/acme-cert.service';
import type { SslStatusResponse } from '../security/acme-cert.service';
import { ThreatDetectorService } from '../security/threat-detector.service';
import type { ThreatTelemetryDashboard } from '../security/threat-detector.service';
import { HsmService } from '../storage/hsm.service';
import type { StorageTierAuditReport } from '../storage/hsm.service';

@ApiTags('admin')
@Controller('admin')
@UseInterceptors(AuditLogInterceptor)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    @Optional() private readonly acmeCertService?: AcmeCertService,
    @Optional() private readonly dynamicConfigService?: DynamicConfigService,
    @Optional() private readonly threatDetectorService?: ThreatDetectorService,
    @Optional() private readonly hsmService?: HsmService,
    @Optional() private readonly auditLogService?: AuditLogService,
  ) {}

  @Get('audit-logs')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Query paginated immutable audit logs with multi-dimensional filtering (Admin only)' })
  async getAuditLogs(@Query() query: AuditLogQueryDto) {
    if (!this.auditLogService) {
      return { data: [], items: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    }
    return this.auditLogService.getAuditLogs(query);
  }

  @Get('audit-logs/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve single immutable audit log entry by ID (Admin only)' })
  @ApiParam({ name: 'id', description: 'Audit log UUID' })
  async getAuditLogById(@Param('id') id: string) {
    if (!this.auditLogService) {
      throw new NotFoundException('Audit log service unavailable');
    }
    return this.auditLogService.getAuditLogById(id);
  }

  @Post('users/:id/unlock')
  @AuditAction('USER_UNLOCKED', { targetType: 'USER', targetIdParam: 'id', description: 'Administrative account unlock' })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually unlock a user account and reset failed brute-force attempt counters (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID, username, or email to unlock' })
  async unlockUser(@Param('id') id: string) {
    return this.adminService.unlockUser(id);
  }

  @Delete('user/:id')
  @AuditAction('USER_DELETED', { targetType: 'USER', targetIdParam: 'id', description: 'Administrative user deletion' })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a user (Admin only)' })
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Post('maintenance')
  @AuditAction('MAINTENANCE_TOGGLED', { targetType: 'SYSTEM', description: 'Maintenance mode toggled' })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle maintenance mode (Admin only)' })
  async toggleMaintenance(@Body('active') active: boolean) {
    return this.adminService.setMaintenanceMode(active);
  }

  async setMaintenanceMode(active: boolean) {
    return this.adminService.setMaintenanceMode(active);
  }

  // --- Dynamic Configuration Endpoints ---

  @Get('config')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all dynamic configuration parameters' })
  getAllConfig() {
    if (!this.dynamicConfigService) {
      throw new BadRequestException('DynamicConfigService is not available');
    }
    return this.dynamicConfigService.getAll();
  }

  @Get('config/audit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get audit logs for dynamic configuration changes' })
  getConfigAuditLogs(@Query('limit') limit?: string) {
    if (!this.dynamicConfigService) {
      throw new BadRequestException('DynamicConfigService is not available');
    }
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.dynamicConfigService.getAuditLogs(parsedLimit);
  }

  @Get('config/:key')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific dynamic configuration parameter' })
  @ApiParam({ name: 'key', description: 'Configuration key name' })
  getConfigKey(@Param('key') key: string) {
    if (!this.dynamicConfigService) {
      throw new BadRequestException('DynamicConfigService is not available');
    }
    return {
      key,
      value: this.dynamicConfigService.get(key as DynamicConfigKey),
    };
  }

  @Put('config/:key')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Update dynamic configuration parameter with Zod schema validation and hot-reload',
  })
  @ApiParam({ name: 'key', description: 'Configuration key name to update' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        value: {
          description:
            'New configuration value (boolean, number, string, object)',
        },
        updatedBy: {
          type: 'string',
          description: 'Identity of the admin performing the update',
          default: 'admin',
        },
      },
      required: ['value'],
    },
  })
  async updateConfig(
    @Param('key') key: string,
    @Body('value') value: unknown,
    @Body('updatedBy') updatedBy?: string,
  ) {
    if (!this.dynamicConfigService) {
      throw new BadRequestException('DynamicConfigService is not available');
    }
    return this.dynamicConfigService.set(key, value, updatedBy ?? 'admin');
  }

  // --- SSL/TLS Certificate Endpoints ---

  @Get('ssl-status')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get SSL/TLS certificate auto-renewal and expiration status',
  })
  getSslStatus(): SslStatusResponse {
    if (!this.acmeCertService) {
      throw new BadRequestException('AcmeCertService is not available');
    }
    return this.acmeCertService.getCertificateStatus();
  }

  @Post('ssl-renew')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Manually trigger ACME SSL certificate check and renewal',
  })
  async triggerSslRenewal(): Promise<{
    renewed: boolean;
    status: SslStatusResponse;
  }> {
    if (!this.acmeCertService) {
      throw new BadRequestException('AcmeCertService is not available');
    }
    const renewed = await this.acmeCertService.checkAndRenewCertificate();
    return {
      renewed,
      status: this.acmeCertService.getCertificateStatus(),
    };
  }

  // --- ML API Threat Detection & Anomaly Telemetry ---

  @Get('threat-telemetry')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get real-time ML API threat detection scores, active IP quarantines, and anomaly vector telemetry',
  })
  getThreatTelemetry(): ThreatTelemetryDashboard {
    if (!this.threatDetectorService) {
      throw new BadRequestException('ThreatDetectorService is not available');
    }
    return this.threatDetectorService.getThreatTelemetry();
  }

  // --- Hierarchical Storage Management (HSM) Tier Audit ---

  @Get('storage-tiers')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Audit multi-tier hierarchical storage distribution (Hot NVMe, Warm S3, Cold Glacier) and cost savings',
  })
  async getStorageTiers(): Promise<StorageTierAuditReport> {
    if (!this.hsmService) {
      throw new BadRequestException('HsmService is not available');
    }
    return this.hsmService.getStorageTierAudit();
  }
}
