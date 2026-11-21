import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { DeveloperGraphService } from './developer-graph.service';
import type {
  GraphRecommendationResult,
  MentorRecommendationResult,
  ProjectRecommendationResult,
  PageRankResult,
  CommunityDetectionResult,
  GraphTraversalResult,
} from './developer-graph.service';
import {
  GraphRecommendationQueryDto,
  PageRankQueryDto,
  GraphTraversalQueryDto,
  SyncGraphEventDto,
  RecommendationType,
} from './dto/graph-query.dto';

@ApiTags('graph')
@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: DeveloperGraphService) {}

  @Get('recommendations')
  @ApiOperation({
    summary:
      'Get collaborative filtering recommendations (peers, mentors, or projects) over developer knowledge graph',
  })
  @ApiResponse({
    status: 200,
    description: 'List of ranked graph recommendations',
  })
  async getRecommendations(
    @Query() query: GraphRecommendationQueryDto,
  ): Promise<
    | GraphRecommendationResult[]
    | MentorRecommendationResult[]
    | ProjectRecommendationResult[]
  > {
    const devId = query.developerId || 'default-dev';
    const limit = query.limit || 10;

    switch (query.type) {
      case RecommendationType.MENTORS:
        return this.graphService.getMentorRecommendations(devId, query.skill, limit);

      case RecommendationType.PROJECTS:
        return this.graphService.getProjectRecommendations(devId, limit);

      case RecommendationType.PEERS:
      default:
        return this.graphService.getPeerRecommendations(devId, limit);
    }
  }

  @Get('recommendations/peers/:developerId')
  @ApiOperation({
    summary: 'Get multi-hop peer recommendations (2nd and 3rd degree connections)',
  })
  @ApiParam({ name: 'developerId', description: 'Target developer ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPeerRecommendations(
    @Param('developerId') developerId: string,
    @Query('limit') limit?: string,
  ): Promise<GraphRecommendationResult[]> {
    const lim = limit ? parseInt(limit, 10) : 10;
    return this.graphService.getPeerRecommendations(developerId, isNaN(lim) ? 10 : lim);
  }

  @Get('recommendations/mentors/:developerId')
  @ApiOperation({
    summary: 'Get personalized mentor recommendations based on mastered skills & graph proximity',
  })
  @ApiParam({ name: 'developerId', description: 'Mentee developer ID' })
  @ApiQuery({ name: 'skill', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMentorRecommendations(
    @Param('developerId') developerId: string,
    @Query('skill') skill?: string,
    @Query('limit') limit?: string,
  ): Promise<MentorRecommendationResult[]> {
    const lim = limit ? parseInt(limit, 10) : 10;
    return this.graphService.getMentorRecommendations(developerId, skill, isNaN(lim) ? 10 : lim);
  }

  @Get('recommendations/projects/:developerId')
  @ApiOperation({
    summary: 'Get personalized project & repository recommendations based on collaborator graph',
  })
  @ApiParam({ name: 'developerId', description: 'Target developer ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getProjectRecommendations(
    @Param('developerId') developerId: string,
    @Query('limit') limit?: string,
  ): Promise<ProjectRecommendationResult[]> {
    const lim = limit ? parseInt(limit, 10) : 10;
    return this.graphService.getProjectRecommendations(developerId, isNaN(lim) ? 10 : lim);
  }

  @Get('pagerank')
  @ApiOperation({
    summary: 'Compute PageRank centrality algorithm to identify influential developers',
  })
  async getPageRank(
    @Query() query: PageRankQueryDto,
  ): Promise<PageRankResult[]> {
    return this.graphService.computePageRank(query.dampingFactor, query.iterations);
  }

  @Get('communities')
  @ApiOperation({
    summary: 'Execute Louvain community detection to discover developer tech clusters',
  })
  async getCommunities(): Promise<CommunityDetectionResult[]> {
    return this.graphService.detectCommunities();
  }

  @Get('traversal/:developerId')
  @ApiOperation({
    summary: 'Execute 4-degree graph relationship traversal benchmark (< 25ms SLA)',
  })
  @ApiParam({ name: 'developerId', description: 'Start node developer ID' })
  @ApiQuery({ name: 'maxDegree', required: false, type: Number })
  async traverseNetwork(
    @Param('developerId') developerId: string,
    @Query('maxDegree') maxDegree?: string,
  ): Promise<GraphTraversalResult> {
    const deg = maxDegree ? parseInt(maxDegree, 10) : 4;
    return this.graphService.traverse4DegreeNetwork(developerId, isNaN(deg) ? 4 : deg);
  }

  @Post('sync/event')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Synchronize graph nodes and relationships from PostgreSQL events',
  })
  @ApiBody({ type: SyncGraphEventDto })
  async syncEvent(
    @Body() eventDto: SyncGraphEventDto,
  ): Promise<{ success: boolean; entityId: string }> {
    return this.graphService.syncEvent(eventDto);
  }
}

