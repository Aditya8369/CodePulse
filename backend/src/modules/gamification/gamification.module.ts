import { Module } from '@nestjs/common';
import { BattlePassService } from './battle-pass.service';
import { SeasonPassService } from './season-pass.service';

@Module({
  providers: [BattlePassService, SeasonPassService],
  exports: [BattlePassService, SeasonPassService],
})
export class GamificationModule {}
