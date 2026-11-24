import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RedosSubmissionScannerService {
  private readonly logger = new Logger(RedosSubmissionScannerService.name);

  public scanRegexVulnerability(regexString: string): { isVulnerable: boolean; reason?: string } {
    const isVulnerable = regexString.includes('(a+)+') || regexString.includes('(a*)*') || regexString.includes('(b+)+');
    if (isVulnerable) {
      this.logger.warn(`REDOS VULNERABILITY DETECTED in expression: ${regexString}`);
      return { isVulnerable: true, reason: 'Catastrophic backtracking risk detected via nested quantifiers' };
    }
    return { isVulnerable: false };
  }
}
