import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { TranspilerService } from './transpiler.service';
import { PrAnalyzerService } from './pr-analyzer.service';
import { CodeReviewerService } from './code-reviewer.service';
import { ChangelogGeneratorService } from './changelog-generator.service';
import { PersonaBattleService } from './persona-battle.service';
import { CodeHintService } from './code-hint.service';
import { GithubModule } from '../github/github.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisService } from '../../common/redis/redis.service';

@Module({
  imports: [GithubModule, PrismaModule],
  controllers: [AiController],
  providers: [
    TranspilerService,
    PrAnalyzerService,
    CodeReviewerService,
    ChangelogGeneratorService,
    PersonaBattleService,
    CodeHintService,
    RedisService,
  ],
  exports: [
    TranspilerService,
    PrAnalyzerService,
    CodeReviewerService,
    ChangelogGeneratorService,
    PersonaBattleService,
    CodeHintService,
  ],
})
export class AiModule {}
