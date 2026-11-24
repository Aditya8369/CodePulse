import { Injectable, Logger } from '@nestjs/common';

export interface GuildQuest {
  questId: string;
  targetMetric: string;
  requiredValue: number;
  currentProgress: number;
}

@Injectable()
export class GuildQuestGoalValidatorService {
  private readonly logger = new Logger(GuildQuestGoalValidatorService.name);

  public evaluateCompletion(quest: GuildQuest): { isCompleted: boolean; percentProgress: number } {
    const ratio = quest.requiredValue > 0 ? quest.currentProgress / quest.requiredValue : 1;
    const percent = Math.min(100, Math.round(ratio * 100));
    return {
      isCompleted: quest.currentProgress >= quest.requiredValue,
      percentProgress: percent
    };
  }
}
