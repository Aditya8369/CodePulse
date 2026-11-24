import { Injectable, Logger } from '@nestjs/common';

export type PodDrainPhase = 'HEALTHY' | 'DRAIN_REQUESTED' | 'CHECKPOINTING' | 'SAFE_TO_TERMINATE';

@Injectable()
export class K8sPodDrainCoordinatorService {
  private readonly logger = new Logger(K8sPodDrainCoordinatorService.name);
  private phase: PodDrainPhase = 'HEALTHY';
  private readonly activeMatches = new Set<string>();

  public registerMatch(matchId: string): void {
    if (this.phase !== 'HEALTHY') {
      throw new Error(`Cannot accept match ${matchId} while pod is draining`);
    }
    this.activeMatches.add(matchId);
  }

  public initiateDrain(podId: string): { phase: PodDrainPhase; safeToTerminate: boolean } {
    this.logger.warn(`K8s preStop drain signaled for pod ${podId}`);
    if (this.activeMatches.size === 0) {
      this.phase = 'SAFE_TO_TERMINATE';
    } else {
      this.phase = 'CHECKPOINTING';
    }
    return { phase: this.phase, safeToTerminate: this.phase === 'SAFE_TO_TERMINATE' };
  }

  public checkpointAndEvacuateMatch(matchId: string): boolean {
    if (!this.activeMatches.has(matchId)) return false;
    this.activeMatches.delete(matchId);
    if (this.activeMatches.size === 0 && this.phase === 'CHECKPOINTING') {
      this.phase = 'SAFE_TO_TERMINATE';
    }
    return true;
  }

  public getPhase(): PodDrainPhase {
    return this.phase;
  }
}
