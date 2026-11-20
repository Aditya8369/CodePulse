import { Module } from '@nestjs/common';
import { BattlePassService } from './battle-pass.service';

@Module({
  providers: [BattlePassService],
  exports: [BattlePassService],
})
export class GamificationModule {}
