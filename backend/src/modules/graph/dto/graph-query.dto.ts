import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum RecommendationType {
  PEERS = 'peers',
  MENTORS = 'mentors',
  PROJECTS = 'projects',
}

export enum GraphSyncEventType {
  USER_SYNC = 'USER_SYNC',
  SKILL_SYNC = 'SKILL_SYNC',
  REPO_SYNC = 'REPO_SYNC',
  COLLABORATION_SYNC = 'COLLABORATION_SYNC',
  CHALLENGE_SYNC = 'CHALLENGE_SYNC',
  BADGE_SYNC = 'BADGE_SYNC',
}

export enum GraphSyncAction {
  UPSERT = 'UPSERT',
  DELETE = 'DELETE',
}

export class GraphRecommendationQueryDto {
  @ApiPropertyOptional({ description: 'Target developer ID for personalized recommendations' })
  @IsString()
  @IsOptional()
  developerId?: string;

  @ApiPropertyOptional({
    enum: RecommendationType,
    default: RecommendationType.PEERS,
    description: 'Recommendation strategy (peers, mentors, or projects)',
  })
  @IsEnum(RecommendationType)
  @IsOptional()
  type?: RecommendationType = RecommendationType.PEERS;

  @ApiPropertyOptional({ description: 'Optional target skill filter for mentor matching' })
  @IsString()
  @IsOptional()
  skill?: string;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ default: 3, minimum: 1, maximum: 4, description: 'Degrees of graph traversal' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(4)
  @IsOptional()
  maxDegree?: number = 3;
}

export class PageRankQueryDto {
  @ApiPropertyOptional({ default: 0.85, minimum: 0.1, maximum: 0.99 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(0.99)
  @IsOptional()
  dampingFactor?: number = 0.85;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  iterations?: number = 20;
}

export class GraphTraversalQueryDto {
  @ApiProperty({ description: 'Starting developer/entity node ID' })
  @IsString()
  @IsNotEmpty()
  startNodeId: string;

  @ApiPropertyOptional({ description: 'Target node ID for shortest path traversal' })
  @IsString()
  @IsOptional()
  targetNodeId?: string;

  @ApiPropertyOptional({ default: 4, minimum: 1, maximum: 4, description: 'Maximum degrees of separation (up to 4)' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(4)
  @IsOptional()
  maxDegree?: number = 4;
}

export class SyncGraphEventDto {
  @ApiProperty({ enum: GraphSyncEventType, description: 'Type of graph entity/edge event' })
  @IsEnum(GraphSyncEventType)
  @IsNotEmpty()
  eventType: GraphSyncEventType;

  @ApiProperty({ description: 'Unique identifier of the synced entity' })
  @IsString()
  @IsNotEmpty()
  entityId: string;

  @ApiPropertyOptional({ enum: GraphSyncAction, default: GraphSyncAction.UPSERT })
  @IsEnum(GraphSyncAction)
  @IsOptional()
  action?: GraphSyncAction = GraphSyncAction.UPSERT;

  @ApiProperty({ description: 'Payload containing node/edge attributes' })
  @IsObject()
  @IsNotEmpty()
  payload: Record<string, any>;
}

