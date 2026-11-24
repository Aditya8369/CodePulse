import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DeveloperCareerMarkovPredictorService {
  private readonly logger = new Logger(DeveloperCareerMarkovPredictorService.name);
  private transitions = new Map<string, Map<string, number>>(); // state -> nextState -> probability

  public setTransitionProbability(fromState: string, toState: string, prob: number): void {
    if (!this.transitions.has(fromState)) {
      this.transitions.set(fromState, new Map());
    }
    this.transitions.get(fromState)!.set(toState, prob);
  }

  public predictNextStage(currentState: string): { predictedStage: string; probability: number } {
    const nextMap = this.transitions.get(currentState);
    if (!nextMap || nextMap.size === 0) {
      return { predictedStage: currentState, probability: 1.0 };
    }

    let bestStage = currentState;
    let maxProb = -1;

    for (const [st, p] of nextMap.entries()) {
      if (p > maxProb) {
        maxProb = p;
        bestStage = st;
      }
    }

    return { predictedStage: bestStage, probability: maxProb };
  }
}
