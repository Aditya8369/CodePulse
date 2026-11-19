import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export enum WebhookEvent {
  BATTLE_ENDED = 'battle.ended',
  PR_REVIEWED = 'pr.reviewed',
  BADGE_AWARDED = 'badge.awarded',
  CHALLENGE_COMPLETED = 'challenge.completed',
  ALL = '*',
}

export class CreateWebhookSubscriptionDto {
  @ApiProperty({
    description: 'Endpoint destination URL where payloads will be posted',
    example: 'https://api.mycorp.com/codepulse-webhooks',
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  @IsNotEmpty()
  url: string;

  @ApiPropertyOptional({
    description: 'Custom HMAC-SHA256 signing secret. If omitted, a secure 32-byte secret is generated.',
    example: 'whsec_sample_hmac_signing_secret_hex_key_32bytes',
  })
  @IsOptional()
  @IsString()
  secret?: string;

  @ApiPropertyOptional({
    description: 'Human-readable description or label',
    example: 'Production Slack & Discord notifier',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Events this webhook will receive',
    example: ['battle.ended', 'pr.reviewed', 'badge.awarded'],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  events: string[];
}

export class UpdateWebhookSubscriptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secret?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @ApiPropertyOptional({
    enum: ['ACTIVE', 'PAUSED', 'DISABLED'],
  })
  @IsOptional()
  @IsEnum(['ACTIVE', 'PAUSED', 'DISABLED'])
  status?: 'ACTIVE' | 'PAUSED' | 'DISABLED';
}

export class DispatchWebhookDto {
  @ApiProperty({
    description: 'Event type name',
    example: 'battle.ended',
  })
  @IsString()
  @IsNotEmpty()
  event: string;

  @ApiProperty({
    description: 'Payload data dictionary',
    example: { battleId: '123', winnerId: '456', score: 98 },
  })
  @IsNotEmpty()
  payload: Record<string, unknown>;
}
