import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Optional,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { PrivacyService } from './privacy.service';
import { ProfileHistoryService } from './profile-history.service';
import { UpdateUserDto } from './dto/users.dto';
import {
  RecordProfileMutationDto,
  GetProfileHistoryQueryDto,
  HistoricalProfileResponseDto,
} from './dto/profile-history.dto';
import {
  ConfirmAccountDeletionDto,
  GdprDeletionCertificateDto,
  ShredPreviewDto,
  VerifyCertificateDto,
  VerifyCertificateResponseDto,
} from './dto/privacy.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly privacyService: PrivacyService,
    @Optional() private readonly profileHistoryService?: ProfileHistoryService,
  ) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Request() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(@Request() req: any, @Body() updateDto: UpdateUserDto) {
    return this.usersService.updateProfile(req.user.id, updateDto);
  }

  // --- GDPR Right-to-be-Forgotten & Cryptographic Shredding Pipeline ---

  @Get('privacy/preview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Preview GDPR cryptographic shredding impact before execution' })
  @ApiResponse({ status: 200, type: ShredPreviewDto })
  async previewShred(@Request() req: any): Promise<ShredPreviewDto> {
    return this.privacyService.previewShred(req.user.id);
  }

  @Post('privacy/delete-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm and execute GDPR Right-to-be-Forgotten cryptographic shredding' })
  @ApiResponse({ status: 200, type: GdprDeletionCertificateDto })
  async deleteAccount(
    @Request() req: any,
    @Body() dto?: ConfirmAccountDeletionDto,
  ): Promise<GdprDeletionCertificateDto> {
    return this.privacyService.shredUserAccount(req.user.id, dto);
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'DELETE alias for GDPR Right-to-be-Forgotten cryptographic shredding' })
  @ApiResponse({ status: 200, type: GdprDeletionCertificateDto })
  async deleteAccountRest(
    @Request() req: any,
    @Body() dto?: ConfirmAccountDeletionDto,
  ): Promise<GdprDeletionCertificateDto> {
    return this.privacyService.shredUserAccount(req.user.id, dto);
  }

  @Get('privacy/certificates/:id')
  @ApiOperation({ summary: 'Retrieve GDPR Compliance Deletion Certificate by ID or certificateNumber' })
  @ApiResponse({ status: 200, type: GdprDeletionCertificateDto })
  async getCertificate(@Param('id') id: string): Promise<GdprDeletionCertificateDto> {
    return this.privacyService.getDeletionCertificate(id);
  }

  @Post('privacy/verify-certificate')
  @ApiOperation({ summary: 'Verify an exportable GDPR Compliance Certificate signature' })
  @ApiResponse({ status: 200, type: VerifyCertificateResponseDto })
  async verifyCertificate(
    @Body() dto: VerifyCertificateDto,
  ): Promise<VerifyCertificateResponseDto> {
    return this.privacyService.verifyCertificate(dto);
  }

  // --- Bi-Temporal Developer Profile History & Time-Travel Architecture (#385) ---

  @Get(':username/history')
  @ApiOperation({
    summary:
      'Time-travel query developer profile at any arbitrary point in history (bi-temporal valid-time & system-time)',
  })
  @ApiQuery({
    name: 'at',
    required: false,
    description: 'Valid-time point (ISO timestamp, e.g. 2026-06-01T00:00:00Z)',
  })
  @ApiQuery({
    name: 'asOf',
    required: false,
    description: 'System/transaction time point for true bi-temporal state audit',
  })
  @ApiQuery({
    name: 'timeline',
    required: false,
    description: 'Set to true to retrieve full historical validity timeline',
  })
  @ApiResponse({ status: 200, type: HistoricalProfileResponseDto })
  async getDeveloperProfileHistory(
    @Param('username') username: string,
    @Query() query: GetProfileHistoryQueryDto,
  ) {
    if (!this.profileHistoryService) {
      throw new NotFoundException('ProfileHistoryService is not available');
    }

    if (query.timeline === 'true') {
      return this.profileHistoryService.getTimeline(username);
    }

    const targetTime = query.at || new Date().toISOString();

    const snapshot = query.asOf
      ? await this.profileHistoryService.getProfileBiTemporal(
          username,
          targetTime,
          query.asOf,
        )
      : await this.profileHistoryService.getProfileAt(username, targetTime);

    if (!snapshot) {
      throw new NotFoundException(
        `No historical profile record found for user '${username}' at valid-time ${targetTime}${
          query.asOf ? ` as-of system-time ${query.asOf}` : ''
        }.`,
      );
    }

    return snapshot;
  }

  @Post(':username/history')
  @ApiOperation({ summary: 'Record a bi-temporal profile or rating mutation slice' })
  async recordProfileHistory(
    @Param('username') username: string,
    @Body() dto: RecordProfileMutationDto,
  ) {
    if (!this.profileHistoryService) {
      throw new NotFoundException('ProfileHistoryService is not available');
    }
    return this.profileHistoryService.recordProfileMutation({
      ...dto,
      userId: dto.userId || username,
    });
  }

  // --- Public Profile by Username (Must remain after all static paths) ---

  @Get(':username')
  @ApiOperation({ summary: 'Get public developer profile by username' })
  async getPublicProfile(@Param('username') username: string) {
    return this.usersService.findByUsername(username);
  }
}
