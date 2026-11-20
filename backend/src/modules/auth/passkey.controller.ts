import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PasskeyService } from './passkey.service';
import { AttestationValidatorService } from './attestation-validator.service';

@ApiTags('webauthn')
@Controller('auth/passkeys')
export class PasskeyController {
  constructor(
    private readonly passkeyService: PasskeyService,
    private readonly attestationValidator: AttestationValidatorService,
  ) {}

  @Post('register/options')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate WebAuthn hardware token registration options',
  })
  async getRegistrationOptions(
    @Req()
    req: {
      user?: {
        id: string;
        username?: string;
        role?: string;
        organizationId?: string;
      };
    },
    @Body() body?: { organizationId?: string; userRole?: string },
  ) {
    const userId = req.user!.id;
    const username = req.user?.username || userId;
    return this.passkeyService.generateRegistrationOptions({
      userId,
      username,
      userRole: body?.userRole || req.user?.role || 'USER',
      organizationId: body?.organizationId || req.user?.organizationId,
    });
  }

  @Post('register/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Verify WebAuthn attestation statement against FIDO MDS3 Root CAs and register credential',
  })
  async verifyRegistration(
    @Req()
    req: {
      user?: {
        id: string;
        username?: string;
        role?: string;
        organizationId?: string;
      };
    },
    @Body()
    body: {
      attestationObject: string;
      clientDataJSON: string;
      deviceLabel?: string;
      transports?: string[];
      userRole?: string;
      organizationId?: string;
    },
  ) {
    const userId = req.user!.id;
    return this.passkeyService.verifyAndRegisterPasskey({
      userId,
      username: req.user?.username || userId,
      userRole: body.userRole || req.user?.role,
      organizationId: body.organizationId || req.user?.organizationId,
      deviceLabel: body.deviceLabel,
      transports: body.transports,
      attestationObject: body.attestationObject,
      clientDataJSON: body.clientDataJSON,
    });
  }

  @Post('authenticate/options')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate WebAuthn authentication assertion options' })
  async getAuthenticationOptions(@Body('userId') userId: string) {
    return this.passkeyService.generateAuthenticationOptions(userId);
  }

  @Post('authenticate/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify WebAuthn hardware security key assertion' })
  async verifyAuthentication(
    @Body()
    body: {
      userId: string;
      credentialId: string;
      authenticatorData: string;
      clientDataJSON: string;
      signature: string;
    },
  ) {
    return this.passkeyService.verifyAuthenticationAssertion(body);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List registered hardware security keys and passkeys' })
  listCredentials(@Req() req: { user?: { id: string } }) {
    return this.passkeyService.getUserCredentials(req.user!.id);
  }

  @Delete(':credentialId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a registered hardware security key' })
  revokeCredential(
    @Req() req: { user?: { id: string } },
    @Param('credentialId') credentialId: string,
  ) {
    const removed = this.passkeyService.revokeUserCredential(
      req.user!.id,
      credentialId,
    );
    if (!removed) {
      throw new NotFoundException('Security key credential not found');
    }
    return { removed: true, credentialId };
  }

  @Put('policy/:organizationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Configure organization hardware-only security key policy (rejects software passkeys for admins)',
  })
  updateOrganizationPolicy(
    @Param('organizationId') organizationId: string,
    @Body()
    body: {
      requireHardwareAttestation?: boolean;
      enforceForAdminRoles?: boolean;
      adminRoles?: string[];
      allowedAaguids?: string[];
      requireUserVerification?: boolean;
    },
  ) {
    return this.passkeyService.setOrganizationPolicy(organizationId, body);
  }

  @Get('mds/status')
  @ApiOperation({ summary: 'Inspect cached FIDO Alliance MDS3 Root CA status' })
  getMdsStatus() {
    return this.attestationValidator.getMdsStatus();
  }

  @Post('mds/refresh')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Download and cache FIDO Alliance MDS3 Root CA certificates in Redis',
  })
  async refreshMds() {
    const payload =
      await this.attestationValidator.loadMdsFromCacheOrRemote(true);
    return {
      fetchedAt: payload.fetchedAt,
      rootCaCount: payload.rootCertificatesPem.length,
      metadataEntriesCount: Object.keys(payload.metadataByAaguid).length,
    };
  }
}
