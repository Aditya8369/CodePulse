import { Injectable } from '@nestjs/common';

export type RoomTopologyMode = 'FULL_MESH' | 'SFU_HYBRID';

@Injectable()
export class MeshTopologyOptimizerService {
  private readonly fullMeshPeerThreshold = 4;

  public determineOptimalTopology(peerCount: number, averageBandwidthKbps: number): { mode: RoomTopologyMode; reason: string } {
    // If peer count > 4 or upstream bandwidth is constrained (< 1000 kbps), switch from full mesh to SFU hybrid
    if (peerCount > this.fullMeshPeerThreshold || averageBandwidthKbps < 1000) {
      return {
        mode: 'SFU_HYBRID',
        reason: `Peer count ${peerCount} or bandwidth ${averageBandwidthKbps}kbps exceeds full-mesh quadratic upload limit`,
      };
    }

    return {
      mode: 'FULL_MESH',
      reason: 'Low peer count and optimal bandwidth allow direct P2P mesh',
    };
  }
}
