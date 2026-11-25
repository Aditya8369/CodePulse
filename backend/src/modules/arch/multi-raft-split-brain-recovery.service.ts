import { Injectable, Logger } from '@nestjs/common';

export interface RaftNodeState {
  nodeId: string;
  term: number;
  commitIndex: number;
}

@Injectable()
export class MultiRaftSplitBrainRecoveryService {
  private readonly logger = new Logger(MultiRaftSplitBrainRecoveryService.name);

  public resolveSplitBrain(clusterNodes: RaftNodeState[]): { authoritativeNodeId: string; highestTerm: number; reconciledCommitIndex: number } {
    if (!clusterNodes || clusterNodes.length === 0) {
      throw new Error('NO_NODES_AVAILABLE');
    }

    let authoritative = clusterNodes[0];

    for (const node of clusterNodes) {
      if (node.term > authoritative.term) {
        authoritative = node;
      } else if (node.term === authoritative.term && node.commitIndex > authoritative.commitIndex) {
        authoritative = node;
      }
    }

    this.logger.warn(`Raft Split-Brain Reconciled: Node ${authoritative.nodeId} selected (Term: ${authoritative.term}, Commit: ${authoritative.commitIndex})`);
    return {
      authoritativeNodeId: authoritative.nodeId,
      highestTerm: authoritative.term,
      reconciledCommitIndex: authoritative.commitIndex
    };
  }
}
