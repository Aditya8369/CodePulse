import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { TranspilerService } from './transpiler.service';
import { PrAnalyzerService } from './pr-analyzer.service';
import { ChangelogGeneratorService } from './changelog-generator.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [TranspilerService, PrAnalyzerService, ChangelogGeneratorService],
  exports: [TranspilerService, PrAnalyzerService, ChangelogGeneratorService],
})
export class AiModule {}
