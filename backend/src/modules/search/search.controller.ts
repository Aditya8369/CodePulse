import { Controller, Get, Post, Body, Query, UseGuards, Optional } from '@nestjs/common';
import { PowChallengeGuard } from '../../common/guards/pow-challenge.guard';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { RagCodeSearchService } from './rag-code-search.service';
import { IndexCodeFileDto, SemanticCodeSearchDto } from './dto/code-search.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    @Optional() private readonly ragCodeSearch?: RagCodeSearchService,
  ) {}

  @Get()
  @UseGuards(PowChallengeGuard)
  @ApiOperation({ summary: 'Global search for users and repositories' })
  async search(@Query('q') query: string) {
    return this.searchService.searchGlobal(query);
  }

  @Post('code/index')
  @ApiOperation({ summary: 'Index a repository TypeScript file into hierarchical AST multi-vector chunks' })
  async indexCodeFile(@Body() dto: IndexCodeFileDto) {
    const chunks = await this.ragCodeSearch?.indexFile(dto);
    return { indexedCount: chunks?.length ?? 0, chunks };
  }

  @Post('code/semantic')
  @ApiOperation({ summary: 'Semantic hybrid BM25 + Cosine code search with top-5 Cross-Encoder reranking' })
  async searchSemanticCode(@Body() dto: SemanticCodeSearchDto) {
    return this.ragCodeSearch?.searchSemanticCode(dto);
  }
}
