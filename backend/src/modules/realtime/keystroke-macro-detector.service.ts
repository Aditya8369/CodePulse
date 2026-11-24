import { Injectable } from '@nestjs/common';

@Injectable()
export class KeystrokeMacroDetectorService {
  private readonly clientKeystrokes = new Map<string, number[]>();

  public recordKeystroke(clientId: string, timestamp: number): { isMacro: boolean; variance: number } {
    const list = this.clientKeystrokes.get(clientId) || [];
    list.push(timestamp);
    if (list.length > 20) list.shift();
    this.clientKeystrokes.set(clientId, list);

    if (list.length < 8) return { isMacro: false, variance: 100 };

    // Compute intervals and standard deviation
    const intervals: number[] = [];
    for (let i = 1; i < list.length; i++) {
      intervals.push(list[i] - list[i - 1]);
    }

    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;

    // Inhumanly low variance (< 2ms^2) or impossible typing speed (< 15ms interval) indicates synthetic macro injection
    const isMacro = variance < 2 || mean < 15;
    return { isMacro, variance };
  }
}
