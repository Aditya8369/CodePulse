import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiParam, ApiBody } from '@nestjs/swagger';
import { TyposquatScannerService } from './typosquat-scanner.service';
import {
  SecurityMttrService,
  type VulnerabilityLifecycleRecord,
} from './security-mttr.service';
import { MpcVaultService } from './mpc-vault.service';
import type {
  CreateVaultSecretDto,
  ReconstructVaultSecretDto,
  RotateVaultSecretDto,
  MpcSecretMetadata,
} from './mpc-vault.service';
import {
  ScanPackageDto,
  ScanResultDto,
  ScanSinglePackageDto,
  TypoSquatFinding,
} from './dto/scan-package.dto';

@ApiTags('security')
@Controller('security')
export class SecurityController {
  constructor(
    private readonly typosquatScannerService: TyposquatScannerService,
    private readonly mpcVaultService: MpcVaultService,
  ) {}

  @Post('scan-dependencies')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Scan dependency manifest for typo-squatting, homoglyphs, and dependency confusion attacks',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns risk severity score and install authorization status',
    type: ScanResultDto,
  })
  async scanDependencies(
    @Body() dto: ScanPackageDto,
  ): Promise<ScanResultDto> {
    return this.typosquatScannerService.scanDependencies(
      dto.dependencies,
      dto.protectedNamespaces,
    );
  }

  @Post('scan-package')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Scan a single package dependency for typosquatting and confusion risk',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns detailed risk evaluation for the single package',
  })
  async scanSinglePackage(
    @Body() dto: ScanSinglePackageDto,
  ): Promise<TypoSquatFinding> {
    return this.typosquatScannerService.scanPackage({
      name: dto.name,
      ecosystem: dto.ecosystem,
      version: dto.version,
    });
  }

  // ==========================================
  // MPC Threshold Cryptography Vault (#547)
  // ==========================================

  @Post('mpc/init')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Initialize MPC threshold vault secret, split into N shares with threshold K (#547)',
  })
  async initMpcSecret(@Body() dto: CreateVaultSecretDto) {
    return this.mpcVaultService.createOrgVaultSecret(dto);
  }

  @Post('mpc/reconstruct')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reconstruct MPC secret in ephemeral memory from threshold K valid shares (#547)',
  })
  async reconstructMpcSecret(@Body() dto: ReconstructVaultSecretDto) {
    return this.mpcVaultService.reconstructOrgSecret(dto);
  }

  @Post('mpc/rotate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate MPC secret using existing threshold authorization and generate new polynomial shares (#547)',
  })
  async rotateMpcSecret(@Body() dto: RotateVaultSecretDto) {
    return this.mpcVaultService.rotateOrgSecret(dto);
  }

  @Post('mpc/burn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke and burn a compromised or departed admin share (#547)',
  })
  async burnMpcShare(
    @Body('organizationId') organizationId: string,
    @Body('secretName') secretName: string,
    @Body('shareIndex') shareIndex: number,
    @Body('requesterId') requesterId: string,
    @Body('reason') reason?: string,
  ) {
    return this.mpcVaultService.burnShare(
      organizationId,
      secretName,
      shareIndex,
      requesterId,
      reason,
    );
  }

  @Get('mpc/secrets/:orgId')
  @ApiOperation({
    summary: 'List all MPC Vault secrets for an organization (#547)',
  })
  @ApiParam({ name: 'orgId' })
  async listOrgSecrets(@Param('orgId') orgId: string) {
    return this.mpcVaultService.listOrgSecrets(orgId);
  }

  @Get('mpc/secrets/:orgId/:name')
  @ApiOperation({
    summary: 'Get MPC Vault secret metadata and share allocation status (#547)',
  })
  @ApiParam({ name: 'orgId' })
  @ApiParam({ name: 'name' })
  async getSecretMetadata(
    @Param('orgId') orgId: string,
    @Param('name') name: string,
  ): Promise<MpcSecretMetadata> {
    return this.mpcVaultService.getSecretMetadata(orgId, name);
  }

  @Get('mpc/audit/:secretId')
  @ApiOperation({
    summary: 'Retrieve cryptographic HMAC-signed audit proofs for an MPC secret (#547)',
  })
  @ApiParam({ name: 'secretId' })
  async getAuditProofs(@Param('secretId') secretId: string) {
    return this.mpcVaultService.getAuditProofs(secretId);
  }

  @Post('mttr/advisories')
  @HttpCode(HttpStatus.CREATED)
  recordVulnerabilityAdvisory(
    @Body()
    dto: Omit<VulnerabilityLifecycleRecord, 'deployedInProduction'> & {
      deployedInProduction?: boolean;
    },
  ) {
    return this.securityMttrService?.recordAdvisory(dto);
  }

  @Post('mttr/advisories/:advisoryId/correlate-pr')
  @HttpCode(HttpStatus.OK)
  correlateAdvisoryWithPr(
    @Param('advisoryId') advisoryId: string,
    @Body()
    dto: {
      fixPrNumber: number;
      fixPrCreatedAt: string;
      fixMergedAt?: string;
      patchedVersion?: string;
    },
  ) {
    return this.securityMttrService?.correlateAdvisoryWithPr({
      advisoryId,
      ...dto,
    });
  }

  @Get('mttr/repositories/:repositoryId')
  getRepositoryMttrMetrics(
    @Param('repositoryId') repositoryId: string,
    @Query('asOf') asOf?: string,
  ) {
    return this.securityMttrService?.calculateRepositoryMttr(repositoryId, asOf);
  }

  @Get('mttr/repositories/:repositoryId/compliance-pdf')
  downloadComplianceAuditPdf(
    @Param('repositoryId') repositoryId: string,
    @Query('standard') standard: 'SOC2' | 'ISO_27001' = 'SOC2',
    @Res() res?: Response,
  ) {
    const pdfBuffer = this.securityMttrService?.generateExecutiveCompliancePdf(
      repositoryId,
      standard,
    );
    if (res && pdfBuffer) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${repositoryId}-${standard}-audit.pdf"`,
      );
      res.send(pdfBuffer);
    }
    return pdfBuffer;
  }
}
