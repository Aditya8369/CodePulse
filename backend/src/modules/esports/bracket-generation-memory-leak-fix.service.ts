import { Injectable, Logger } from '@nestjs/common';

export interface RoundStructure {
  roundNumber: number;
  matchCount: number;
}

@Injectable()
export class BracketGenerationMemoryLeakFixService {
  private readonly logger = new Logger(BracketGenerationMemoryLeakFixService.name);

  public generateRoundsIteratively(entrantCount: number): RoundStructure[] {
    const rounds: RoundStructure[] = [];
    let currentMatches = Math.floor(entrantCount / 2);
    let roundNum = 1;

    while (currentMatches >= 1) {
      rounds.push({ roundNumber: roundNum, matchCount: currentMatches });
      currentMatches = Math.floor(currentMatches / 2);
      roundNum++;
    }

    return rounds;
  }
}
