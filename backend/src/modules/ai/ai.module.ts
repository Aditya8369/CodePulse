import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { TranspilerService } from './transpiler.service';
import { PrAnalyzerService } from './pr-analyzer.service';
import { CodeHintService } from './code-hint.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [TranspilerService, PrAnalyzerService, CodeHintService],
  exports: [TranspilerService, PrAnalyzerService, CodeHintService],
})
export class AiModule {}

