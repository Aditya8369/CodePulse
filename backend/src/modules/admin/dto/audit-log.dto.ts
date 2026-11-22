import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AuditActionType {
  USER_BANNED = 'USER_BANNED',
  USER_DELETED = 'USER_DELETED',
  USER_UNLOCKED = 'USER_UNLOCKED',
  ROLE_CHANGED = 'ROLE_CHANGED',
  MAINTENANCE_TOGGLED = 'MAINTENANCE_TOGGLED',
  XP_ADJUSTED = 'XP_ADJUSTED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  TWO_FACTOR_DISABLED = 'TWO_FACTOR_DISABLED',
  API_KEY_REVOKED = 'API_KEY_REVOKED',
  CONFIG_UPDATED = 'CONFIG_UPDATED',
}

export class CreateAuditLogDto {
  @ApiPropertyOptional({ description: 'User ID of the actor who performed the action' })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({ description: 'Email address of the actor' })
  @IsOptional()
  @IsString()
  actorEmail?: string;

  @ApiProperty({ description: 'Action performed', example: 'USER_DELETED' })
  @IsNotEmpty()
  @IsString()
  action: string;

  @ApiPropertyOptional({ description: 'Identifier of the targeted resource' })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional({ description: 'Type of target entity', example: 'USER' })
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional({ description: 'State changes, payload, or diff metadata' })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Client IP address' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'Client User-Agent header' })
  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class AuditLogQueryDto {
  @ApiPropertyOptional({ description: 'Filter by specific audit action' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by actor user ID' })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({ description: 'Filter by target entity ID' })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional({ description: 'Filter by target entity type' })
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional({ description: 'Start date in ISO format (e.g. 2026-11-01T00:00:00Z)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date in ISO format' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Page number for pagination', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
