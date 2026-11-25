/**
 * Architecture Service 60: Distributed State Machine Engine
 * Subsystem: Transactional Persistence and Timer Triggers
 */

export interface StateMachineDefinition {
  initialState: string;
  transitions: Record<string, Record<string, string>>; // state -> event -> nextState
}

export class DistributedStateMachineService {
  private currentStates = new Map<string, string>(); // instanceId -> state
  private readonly definition: StateMachineDefinition;

  constructor(definition: StateMachineDefinition) {
    this.definition = definition;
  }

  public initialize(instanceId: string): string {
    this.currentStates.set(instanceId, this.definition.initialState);
    return this.definition.initialState;
  }

  public transition(instanceId: string, event: string): { success: boolean; state: string } {
    const current = this.currentStates.get(instanceId) || this.definition.initialState;
    const allowed = this.definition.transitions[current];

    if (!allowed || !allowed[event]) {
      return { success: false, state: current };
    }

    const next = allowed[event];
    this.currentStates.set(instanceId, next);
    return { success: true, state: next };
  }

  public getState(instanceId: string): string {
    return this.currentStates.get(instanceId) || this.definition.initialState;
  }
}
