export class KeystrokeVelocityAnalyzerService {
  public analyzeIntervals(intervalsMs: number[]): { isMacroDetected: boolean; variance: number } {
    if (intervalsMs.length < 5) return { isMacroDetected: false, variance: 100 };
    const mean = intervalsMs.reduce((a, b) => a + b, 0) / intervalsMs.length;
    const variance = intervalsMs.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / intervalsMs.length;

    // Zero or near-zero variance indicates synthetic bot/macro paste
    const isMacroDetected = variance < 2.0 && mean < 15.0;
    return { isMacroDetected, variance };
  }
}
