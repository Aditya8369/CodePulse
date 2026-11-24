import { Injectable, Logger } from '@nestjs/common';

export interface DeveloperProfile {
  id: string;
  skills: string[];
}

@Injectable()
export class HackathonTeamSynergyCalculatorService {
  private readonly logger = new Logger(HackathonTeamSynergyCalculatorService.name);

  public calculateSynergy(team: DeveloperProfile[], targetSkills: string[]): { synergyScore: number; coveredSkills: string[] } {
    if (!team || team.length === 0) return { synergyScore: 0, coveredSkills: [] };

    const teamSkills = new Set<string>();
    team.forEach(m => m.skills.forEach(s => teamSkills.add(s.toLowerCase())));

    let coveredCount = 0;
    const covered: string[] = [];

    for (const ts of targetSkills) {
      if (teamSkills.has(ts.toLowerCase())) {
        coveredCount++;
        covered.push(ts);
      }
    }

    const coverageRatio = targetSkills.length > 0 ? coveredCount / targetSkills.length : 1;
    const synergy = Math.round(coverageRatio * 100);

    return { synergyScore: synergy, coveredSkills: covered };
  }
}
