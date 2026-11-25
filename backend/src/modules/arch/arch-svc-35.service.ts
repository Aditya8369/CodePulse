/**
 * Architecture Service 35: Distributed Workflow Checkpointing Engine
 * Subsystem: State Persistence
 */

export interface WorkflowCheckpoint<T = unknown> {
  workflowId: string;
  stepNumber: number;
  state: T;
  savedAt: number;
}

export class DistributedWorkflowCheckpointingService {
  private checkpoints = new Map<string, WorkflowCheckpoint[]>();

  public saveCheckpoint<T>(workflowId: string, stepNumber: number, state: T): WorkflowCheckpoint<T> {
    const list = this.checkpoints.get(workflowId) || [];
    const cp: WorkflowCheckpoint<T> = {
      workflowId,
      stepNumber,
      state,
      savedAt: Date.now(),
    };
    list.push(cp);
    this.checkpoints.set(workflowId, list);
    return cp;
  }

  public getLatestCheckpoint<T>(workflowId: string): WorkflowCheckpoint<T> | undefined {
    const list = this.checkpoints.get(workflowId);
    if (!list || list.length === 0) return undefined;
    return list[list.length - 1] as WorkflowCheckpoint<T>;
  }
}
