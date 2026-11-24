import { Injectable } from '@nestjs/common';

@Injectable()
export class TotpDriftCalibratorService {
  private readonly stepSeconds = 30;

  public getValidTimeSteps(currentTimestampMs: number, allowedDriftSteps = 1): number[] {
    const currentStep = Math.floor(currentTimestampMs / 1000 / this.stepSeconds);
    const steps: number[] = [];
    for (let i = -allowedDriftSteps; i <= allowedDriftSteps; i++) {
      steps.push(currentStep + i);
    }
    return steps;
  }
}
