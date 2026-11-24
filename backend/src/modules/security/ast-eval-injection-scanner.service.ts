import { Injectable } from '@nestjs/common';

@Injectable()
export class AstEvalInjectionScannerService {
  private readonly dangerousPatterns = [
    /eval\s*\(/i,
    /Function\s*\(\s*["'](?:\s*return)?/i,
    /setTimeout\s*\(\s*["']/i,
    /process\s*\.\s*binding/i,
    /child_process/i,
    /\\x[0-9a-f]{2}/i,
  ];

  public scanSourceCode(source: string): { isSafe: boolean; flaggedPatterns: string[] } {
    const flagged: string[] = [];
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(source)) {
        flagged.push(pattern.source);
      }
    }
    return { isSafe: flagged.length === 0, flaggedPatterns: flagged };
  }
}
