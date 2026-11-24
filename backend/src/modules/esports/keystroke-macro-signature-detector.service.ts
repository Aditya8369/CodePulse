import { Injectable, Logger } from '@nestjs/common';

export interface KeystrokeAnalysis {
  isMacroDetected: boolean;
  stdDevMs: number;
}

@Injectable()
export class KeystrokeMacroSignatureDetectorService {
  private readonly logger = new Logger(KeystrokeMacroSignatureDetectorService.name);

  public analyzeIntervals(intervalsMs: number[]): KeystrokeAnalysis {
    if (intervalsMs.length < 5) {
      return { isMacroDetected: false, stdDevMs: 99 };
    }

    const mean = intervalsMs.reduce((a, b) => a + b, 0) / intervalsMs.length;
    const variance = intervalsMs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervalsMs.length;
    const stdDevMs = Math.sqrt(variance);

    // Human typing variance is typically >15ms. Macros often exhibit near-zero variance (<2ms)
    const isMacroDetected = stdDevMs < 2.5;
    if (isMacroDetected) {
      this.logger.warn(`Injected macro detected! Unnaturally low keystroke variance: ${stdDevMs.toFixed(2)}ms`);
    }

    return { isMacroDetected, stdDevMs: Math.round(stdDevMs * 100) / 100 };
  }
}
