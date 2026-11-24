import { Injectable, Logger } from '@nestjs/common';

export interface MentorCandidate {
  id: string;
  skills: string[];
  graphDistance: number;
  availableSlots: number;
}

@Injectable()
export class MentorshipShortestPathMatcherService {
  private readonly logger = new Logger(MentorshipShortestPathMatcherService.name);

  public findBestMentor(requiredSkills: string[], candidates: MentorCandidate[]): string | null {
    // Filter candidates with matching skills and open slots
    const eligible = candidates.filter(c => {
      if (c.availableSlots <= 0) return false;
      return requiredSkills.some(s => c.skills.includes(s));
    });

    if (eligible.length === 0) return null;

    // Pick closest graph distance
    eligible.sort((a, b) => a.graphDistance - b.graphDistance);
    return eligible[0].id;
  }
}
