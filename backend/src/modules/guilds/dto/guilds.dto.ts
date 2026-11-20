import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGuildDto {
  @ApiProperty({ description: 'Guild Name', example: 'OpenSource Avengers' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(32)
  name: string;

  @ApiProperty({ description: 'Guild unique URL slug', example: 'opensource-avengers' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase alphanumeric characters and hyphens' })
  slug: string;

  @ApiProperty({ description: 'Short 3-5 character clan tag', example: 'OPEN' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(6)
  tag: string;

  @ApiPropertyOptional({ description: 'Mission statement or description' })
  @IsString()
  @IsOptional()
  @MaxLength(256)
  description?: string;

  @ApiPropertyOptional({ description: 'Guild avatar URL' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Guild banner background URL' })
  @IsString()
  @IsOptional()
  bannerUrl?: string;

  @ApiPropertyOptional({ description: 'Whether guild is invite-only', default: false })
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ['ADMIN', 'MEMBER'], description: 'New role to assign' })
  @IsString()
  @IsNotEmpty()
  role: 'ADMIN' | 'MEMBER';
}

export class CreateGuildInviteDto {
  @ApiPropertyOptional({ description: 'Expiration in hours', default: 24 })
  @IsOptional()
  expiresInHours?: number;

  @ApiPropertyOptional({ description: 'Maximum uses allowed', default: 5 })
  @IsOptional()
  maxUses?: number;
}
