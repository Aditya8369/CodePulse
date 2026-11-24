import { Injectable } from '@nestjs/common';

export interface ParticipantVote {
  nodeId: string;
  vote: 'PREPARED' | 'ABORT';
}

@Injectable()
export class TwoPhaseCommitManagerService {
  public evaluateQuorum(votes: ParticipantVote[], quorumSize: number): { decision: 'COMMIT' | 'ABORT'; reason: string } {
    if (votes.some((v) => v.vote === 'ABORT')) {
      return { decision: 'ABORT', reason: 'Participant node voted ABORT during prepare phase' };
    }

    const preparedCount = votes.filter((v) => v.vote === 'PREPARED').length;
    if (preparedCount >= quorumSize) {
      return { decision: 'COMMIT', reason: `Raft quorum achieved with ${preparedCount}/${quorumSize} prepared votes` };
    }

    return { decision: 'ABORT', reason: 'Insufficient prepared votes to reach Raft quorum' };
  }
}
