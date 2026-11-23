import { SecurityModule } from '../security/security.module';
import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { RagCodeSearchService } from './rag-code-search.service';

@Module({
  imports: [SecurityModule],
  controllers: [SearchController],
  providers: [SearchService, RagCodeSearchService],
  exports: [SearchService, RagCodeSearchService],
})
export class SearchModule {}
