import { Module, forwardRef } from '@nestjs/common';
import { AiController } from './ai.controller';
import { TranspilerService } from './transpiler.service';
import { PrAnalyzerService } from './pr-analyzer.service';
import { CodeReviewerService } from './code-reviewer.service';
import { ChangelogGeneratorService } from './changelog-generator.service';
import { PersonaBattleService } from './persona-battle.service';
import { CodeHintService } from './code-hint.service';
import { VectorService } from './vector.service';

import { VerificationCoordinatorService } from './swarm/verification-coordinator.service';
import { VerificationSwarmService } from './verification-swarm.service';

import { ComplexityAnalyzerService } from './complexity-analyzer.service';
import { MultiAgentReviewerService } from './agents/pr-reviewer.service';
import { DocEvaluatorService } from './doc-evaluator.service';
import { VoiceCodeAssistantGateway } from './voice-code-assistant.gateway';
import { TestGeneratorService } from './test-generator.service';
import { GithubModule } from '../github/github.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisService } from '../../common/redis/redis.service';

@Module({
  imports: [forwardRef(() => GithubModule), PrismaModule],
  controllers: [AiController],
  providers: [
    TranspilerService,
    PrAnalyzerService,
    CodeReviewerService,
    ChangelogGeneratorService,
    PersonaBattleService,
    CodeHintService,
    VectorService,

    VerificationCoordinatorService,
    VerificationSwarmService,

    ComplexityAnalyzerService,
    MultiAgentReviewerService,
    DocEvaluatorService,
    VoiceCodeAssistantGateway,
    TestGeneratorService,
    RedisService,
  ],
  exports: [
    TranspilerService,
    PrAnalyzerService,
    CodeReviewerService,
    ChangelogGeneratorService,
    PersonaBattleService,
    CodeHintService,
    VectorService,

    VerificationCoordinatorService,
    VerificationSwarmService,

    ComplexityAnalyzerService,
    MultiAgentReviewerService,
    DocEvaluatorService,
    VoiceCodeAssistantGateway,
    TestGeneratorService,
  ],
})
export class AiModule {}
