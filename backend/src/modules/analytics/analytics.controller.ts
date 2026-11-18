import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('platform')
  @ApiOperation({ summary: 'Get global platform statistics' })
  async getPlatformStats() {
    return this.analyticsService.getPlatformStats();
  }

  @Get('privacy-safe-aggregations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get differentially private platform statistics with epsilon budget accounting and cohort suppression',
  })
  async getPrivacySafeAggregations(
    @Request() req: { user: { id: string } },
    @Query('epsilon') epsilon?: string,
  ) {
    const parsedEpsilon = epsilon ? parseFloat(epsilon) : 1.0;
    return this.analyticsService.getPrivacySafeAggregations(
      req.user.id,
      parsedEpsilon,
    );
  }

  @Get('user/:username')
  @ApiOperation({ summary: 'Get aggregated analytics for a specific user' })
  async getUserAnalytics(@Param('username') username: string) {
    return this.analyticsService.getUserAnalytics(username);
  }

  @Get('repository/:repositoryId/commit-punchcard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a repository commit punchcard in a requested timezone' })
  async getRepositoryCommitPunchcard(
    @Request() req: { user: { id: string } },
    @Param('repositoryId') repositoryId: string,
    @Query('timezone') timezone = 'UTC',
  ) {
    return this.analyticsService.getRepositoryCommitPunchcard(req.user.id, repositoryId, timezone);
  }
}
