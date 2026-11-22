import { IsNotEmpty, IsOptional, IsString, IsNumber, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RouteEdgeDto {
  @ApiPropertyOptional({ description: 'Client IP address', example: '203.0.113.195' })
  @IsOptional()
  @IsString()
  ip?: string;

  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2 country code', example: 'IN' })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional({ description: 'Client latitude', example: 19.076 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Client longitude', example: 72.8777 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Measured RTT probes in milliseconds to each regional edge POP',
    example: { 'US-East': 210, 'EU-Central': 130, 'AP-South': 22 },
  })
  @IsOptional()
  @IsObject()
  rttProbes?: Record<string, number>;
}

export class LatencyProbeDto {
  @ApiProperty({ description: 'Battle ID', example: 'battle-123' })
  @IsNotEmpty()
  @IsString()
  battleId: string;

  @ApiProperty({ description: 'Player User ID', example: 'user-456' })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Client measured roundtrip time in milliseconds', example: 34 })
  @IsNumber()
  measuredRttMs: number;

  @ApiPropertyOptional({ description: 'Assigned edge region', example: 'AP-South' })
  @IsOptional()
  @IsString()
  region?: string;
}

