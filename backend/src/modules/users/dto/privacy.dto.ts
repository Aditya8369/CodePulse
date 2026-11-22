import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ConfirmAccountDeletionDto {
  @ApiProperty({
    description: 'User must confirm their username to authorize permanent deletion',
    example: 'johndoe',
  })
  @IsString()
  @IsNotEmpty()
  confirmUsername: string;

  @ApiPropertyOptional({
    description: 'Optional legal or user reason for deletion request',
    example: 'GDPR Right-to-be-Forgotten request under Article 17',
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Optional exit feedback',
    example: 'Leaving platform',
  })
  @IsString()
  @IsOptional()
  feedback?: string;
}

export class ShredSummaryDto {
  @ApiProperty({ description: 'Count of refresh tokens permanently deleted' })
  refreshTokensPurged: number;

  @ApiProperty({ description: 'Count of password reset tokens permanently deleted' })
  passwordResetTokensPurged: number;

  @ApiProperty({ description: 'Count of scoped developer API keys purged' })
  apiKeysPurged: number;

  @ApiProperty({ description: 'Count of notification records permanently erased' })
  notificationsPurged: number;

  @ApiProperty({ description: 'Count of activity timeline events permanently erased' })
  activitiesPurged: number;

  @ApiProperty({ description: 'Count of personal audit log records purged' })
  auditLogsPurged: number;

  @ApiProperty({ description: 'Count of Redis session and cache keys invalidated' })
  redisKeysInvalidated: number;
}

export class GdprDeletionCertificateDto {
  @ApiProperty({ description: 'Unique certificate identifier', example: 'd3b07384d113edec49eaa6238ad5ff00' })
  certificateId: string;

  @ApiProperty({ description: 'Official GDPR Certificate Number', example: 'GDPR-RTBF-2026-A1B2C3D4' })
  certificateNumber: string;

  @ApiProperty({ description: 'Anonymized user identifier (UUID preserved for FK integrity)' })
  userId: string;

  @ApiProperty({ description: 'Anonymized public pseudonym handle', example: 'Ghost-Dev-8392' })
  anonymizedHandle: string;

  @ApiProperty({ description: 'ISO-8601 execution timestamp', example: '2026-11-22T23:00:00.000Z' })
  executedAt: string;

  @ApiProperty({ description: 'Shredding execution status', example: 'CRYPTOGRAPHICALLY_SHREDDED' })
  status: string;

  @ApiProperty({ description: 'Governing legal basis', example: 'GDPR Article 17 - Right to Erasure' })
  legalBasis: string;

  @ApiProperty({ description: 'Categories of personal identifiable data purged from databases' })
  purgedCategories: {
    pii: string[];
    credentials: string[];
    tokens: string[];
    auditTrails: string[];
    cacheStores: string[];
  };

  @ApiProperty({ description: 'Categories preserved to protect mathematical opponent ratings' })
  preservedCategories: {
    historicalMatches: string;
    leaderboardIntegrity: string;
  };

  @ApiProperty({ description: 'Summary statistics of purged records', type: ShredSummaryDto })
  summary: ShredSummaryDto;

  @ApiProperty({ description: 'Cryptographic SHA-256 integrity signature of the deletion record' })
  sha256Signature: string;

  @ApiProperty({ description: 'Exportable Base64 JWT/Certificate token for offline compliance verification' })
  exportableToken: string;
}

export class VerifyCertificateDto {
  @ApiPropertyOptional({ description: 'Certificate number to verify', example: 'GDPR-RTBF-2026-A1B2C3D4' })
  @IsString()
  @IsOptional()
  certificateNumber?: string;

  @ApiPropertyOptional({ description: 'Base64 encoded certificate token' })
  @IsString()
  @IsOptional()
  exportableToken?: string;

  @ApiPropertyOptional({ description: 'SHA-256 signature to verify' })
  @IsString()
  @IsOptional()
  sha256Signature?: string;
}

export class VerifyCertificateResponseDto {
  @ApiProperty({ description: 'Whether certificate is authentic and verifiable' })
  isValid: boolean;

  @ApiProperty({ description: 'Certificate number' })
  certificateNumber: string;

  @ApiProperty({ description: 'Anonymized pseudonym handle' })
  anonymizedHandle: string;

  @ApiProperty({ description: 'Execution timestamp' })
  executedAt: string;

  @ApiProperty({ description: 'Cryptographic signature' })
  sha256Signature: string;

  @ApiProperty({ description: 'Verification status message' })
  message: string;

  @ApiPropertyOptional({ description: 'Full certificate details if available' })
  certificate?: GdprDeletionCertificateDto;
}

export class ShredPreviewDto {
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Current active username' })
  currentUsername: string;

  @ApiProperty({ description: 'Current active email' })
  currentEmail: string;

  @ApiProperty({ description: 'Placeholder handle to be assigned' })
  anonymizedHandlePlaceholder: string;

  @ApiProperty({ description: 'List of PII fields that will be permanently shredded' })
  piiFieldsToShred: string[];

  @ApiProperty({ description: 'Count of tokens and credentials to be purged' })
  tokensToPurgeCount: {
    refreshTokens: number;
    passwordResetTokens: number;
    apiKeys: number;
  };

  @ApiProperty({ description: 'Count of historical battles whose integrity will be preserved' })
  historicalBattlesPreservedCount: number;

  @ApiProperty({ description: 'Notice regarding GDPR compliance and irreversibility' })
  notice: string;
}

