import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
  Response as Res,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiHeader } from '@nestjs/swagger';
import type { Response } from 'express';
import { RepositoriesService } from './repositories.service';
import { ArchiveStreamService } from './archive-stream.service';
import { QueryRepositoriesDto } from './dto/repositories.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('repositories')
@Controller('repositories')
export class RepositoriesController {
  constructor(
    private readonly repositoriesService: RepositoriesService,
    private readonly archiveStreamService: ArchiveStreamService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get paginated repositories for the authenticated user with filtering and sorting',
  })
  async getRepositories(
    @Request() req: any,
    @Query() query: QueryRepositoriesDto,
  ) {
    return this.repositoriesService.getRepositories(req.user.id, query);
  }

  @Get('languages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get distinct programming languages for the authenticated user',
  })
  async getUserLanguages(@Request() req: any) {
    return this.repositoriesService.getUserLanguages(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get repository details by ID' })
  async getRepositoryById(@Request() req: any, @Param('id') id: string) {
    return this.repositoriesService.getRepositoryById(req.user.id, id);
  }

  @Get(':id/download.zip')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Download repository archive as a zero-copy streaming ZIP with HTTP Range Request support',
  })
  @ApiParam({ name: 'id', description: 'Repository ID' })
  @ApiHeader({
    name: 'Range',
    required: false,
    description: 'HTTP Range request header (e.g. bytes=0-1048575)',
  })
  async downloadRepositoryZip(
    @Request() req: any,
    @Param('id') id: string,
    @Res() res: Response,
    @Headers('range') rangeHeader?: string,
    @Headers('accept-encoding') acceptEncoding?: string,
  ) {
    const userId = req.user?.id || req.user?.sub || 'anonymous';
    return this.archiveStreamService.streamRepositoryArchive(
      userId,
      id,
      res,
      {
        rangeHeader,
        acceptEncoding,
      },
    );
  }

  @Post(':id/sync')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Trigger on-demand synchronization for a specific repository',
  })
  async syncRepository(@Request() req: any, @Param('id') id: string) {
    return this.repositoriesService.syncRepository(req.user.id, id);
  }
}
