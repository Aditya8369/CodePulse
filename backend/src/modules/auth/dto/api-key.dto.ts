import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ApiKeyScope {
  READ_ANALYTICS = 'read:analytics',
  WRITE_BATTLES = 'write:battles',
  READ_LEADERBOARD = 'read:leaderboard',
  ADMIN_SYNC = 'admin:sync',
  READ_USER = 'read:user',
  WRITE_USER = 'write:user',
  READ_REPOSITORIES = 'read:repositories',
  WRITE_REPOSITORIES = 'write:repositories',
  ALL = '*',
}

export class CreateApiKeyDto {
  @ApiProperty({
    description: 'Descriptive name for the API key',
    example: 'CI/CD Automation Pipeline',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Array of granular permission scopes',
    example: ['read:analytics', 'write:battles'],
    type: [String],
    default: ['read:analytics'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  scopes?: string[];

  @ApiPropertyOptional({
    description: 'Expiration date in ISO 8601 format (null for non-expiring)',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({
    description: 'Hourly rate limit capacity (requests per hour)',
    example: 1000,
    default: 1000,
  })
  @IsInt()
  @Min(1)
  @Max(100000)
  @IsOptional()
  rateLimit?: number;
}

export class ApiKeyResponseDto {
  @ApiProperty({ example: 'b5e5a201-92b1-4f18-bbd9-3ec2f1f4164b' })
  id: string;

  @ApiProperty({ example: 'CI/CD Automation Pipeline' })
  name: string;

  @ApiProperty({
    description:
      'Plaintext raw API key. Note: this is returned ONCE upon creation and cannot be retrieved again.',
    example: 'cp_live_4a1f9e82c1b74288bf2e99d10e521ad019ca512b54',
  })
  key: string;

  @ApiProperty({ example: 'cp_live_4a1f9e82' })
  keyPrefix: string;

  @ApiProperty({ type: [String], example: ['read:analytics', 'write:battles'] })
  scopes: string[];

  @ApiProperty({ example: 1000 })
  rateLimit: number;

  @ApiProperty({ nullable: true, example: '2026-12-31T23:59:59.000Z' })
  expiresAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}

export class ApiKeyListItemDto {
  @ApiProperty({ example: 'b5e5a201-92b1-4f18-bbd9-3ec2f1f4164b' })
  id: string;

  @ApiProperty({ example: 'CI/CD Automation Pipeline' })
  name: string;

  @ApiProperty({ example: 'cp_live_4a1f9e82' })
  keyPrefix: string;

  @ApiProperty({ type: [String], example: ['read:analytics'] })
  scopes: string[];

  @ApiProperty({ example: 1000 })
  rateLimit: number;

  @ApiProperty({ nullable: true })
  expiresAt: Date | null;

  @ApiProperty({ nullable: true })
  lastUsedAt: Date | null;

  @ApiProperty({ example: 42 })
  requestCount: number;

  @ApiProperty()
  createdAt: Date;
}

