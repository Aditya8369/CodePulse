import { Injectable, Logger } from '@nestjs/common';

export interface Endorsement {
  endorserId: string;
  targetId: string;
  skill: string;
  weight: number; // 1-5
}

@Injectable()
export class MentorshipEndorsementLedgerService {
  private readonly logger = new Logger(MentorshipEndorsementLedgerService.name);
  private ledger: Endorsement[] = [];

  public addEndorsement(endorsement: Endorsement): boolean {
    if (endorsement.endorserId === endorsement.targetId) {
      this.logger.warn('Self-endorsement rejected.');
      return false;
    }
    this.ledger.push(endorsement);
    return true;
  }

  public calculateReputation(targetId: string, skill?: string): number {
    const relevant = this.ledger.filter(e => e.targetId === targetId && (!skill || e.skill === skill));
    return relevant.reduce((acc, curr) => acc + curr.weight, 0);
  }
}
