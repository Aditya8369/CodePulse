import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PowChallengeGuard } from '../../common/guards/pow-challenge.guard';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @UseGuards(PowChallengeGuard)
  @ApiOperation({ summary: 'Global search for users and repositories' })
  async search(@Query('q') query: string) {
    return this.searchService.searchGlobal(query);
  }
}
