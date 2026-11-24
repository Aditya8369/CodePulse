export interface MentorProfile {
  id: string;
  skills: string[];
}

export class Neo4jMentorshipMatcherService {
  public findBestMentor(menteeSkillsNeeded: string[], mentors: MentorProfile[]): MentorProfile | null {
    let bestMentor: MentorProfile | null = null;
    let maxMatch = 0;

    for (const mentor of mentors) {
      const matchCount = mentor.skills.filter(s => menteeSkillsNeeded.includes(s)).length;
      if (matchCount > maxMatch) {
        maxMatch = matchCount;
        bestMentor = mentor;
      }
    }

    return bestMentor;
  }
}
