import { Injectable } from '@nestjs/common';

export interface DeveloperVector {
  userId: string;
  username: string;
  role: 'MENTOR' | 'MENTEE';
  languages: Record<string, number>; // e.g. { TypeScript: 0.9, Rust: 0.8, Python: 0.4 }
  experienceYears: number;
  availableHoursPerWeek: number;
}

export interface MatchResult {
  mentorId: string;
  mentorUsername: string;
  similarityScore: number; // 0 - 100%
  matchingTech: string[];
  experienceGap: number;
}

@Injectable()
export class MentorMatchService {
  /**
   * Calculates cosine similarity between tech stack vector profiles
   */
  findBestMatches(mentee: DeveloperVector, mentors: DeveloperVector[]): MatchResult[] {
    const results: MatchResult[] = [];

    for (const mentor of mentors) {
      if (mentor.role !== 'MENTOR') continue;

      const techKeys = Array.from(
        new Set([...Object.keys(mentee.languages), ...Object.keys(mentor.languages)])
      );

      let dotProduct = 0;
      let magA = 0;
      let magB = 0;
      const matchingTech: string[] = [];

      for (const key of techKeys) {
        const valA = mentee.languages[key] || 0;
        const valB = mentor.languages[key] || 0;

        dotProduct += valA * valB;
        magA += valA * valA;
        magB += valB * valB;

        if (valA > 0 && valB > 0) {
          matchingTech.push(key);
        }
      }

      const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
      const similarity = magnitude === 0 ? 0 : dotProduct / magnitude;
      const similarityPercent = Math.round(similarity * 100);

      results.push({
        mentorId: mentor.userId,
        mentorUsername: mentor.username,
        similarityScore: similarityPercent,
        matchingTech,
        experienceGap: Math.max(0, mentor.experienceYears - mentee.experienceYears),
      });
    }

    return results.sort((a, b) => b.similarityScore - a.similarityScore);
  }
}
