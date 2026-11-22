import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { TranspilerService } from './transpiler.service';
import { PrAnalyzerService } from './pr-analyzer.service';
import { PersonaBattleService } from './persona-battle.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [TranspilerService, PrAnalyzerService, PersonaBattleService],
  exports: [TranspilerService, PrAnalyzerService, PersonaBattleService],
})
export class AiModule {}

