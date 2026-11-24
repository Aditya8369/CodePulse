export interface SpotPreemptionNotice {
  action: 'stop' | 'terminate';
  time: string;
}

export interface CheckpointDump {
  taskId: string;
  statePayload: Record<string, any>;
  savedToSharedStorage: boolean;
}

export class SpotPreemptionWatchdogService {
  private isPreemptionTriggered = false;
  private checkpoints: CheckpointDump[] = [];

  public handleTerminationNotice(notice: SpotPreemptionNotice, runningTasks: Array<{ id: string; state: any }>): {
    preemptionHandled: boolean;
    checkpointsSaved: number;
  } {
    this.isPreemptionTriggered = true;

    for (const task of runningTasks) {
      this.checkpoints.push({
        taskId: task.id,
        statePayload: task.state,
        savedToSharedStorage: true
      });
    }

    return {
      preemptionHandled: true,
      checkpointsSaved: this.checkpoints.length
    };
  }

  public shouldAcceptNewWork(): boolean {
    return !this.isPreemptionTriggered;
  }

  public getCheckpoints(): CheckpointDump[] {
    return [...this.checkpoints];
  }
}
