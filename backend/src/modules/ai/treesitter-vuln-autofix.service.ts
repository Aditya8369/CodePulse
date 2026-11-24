import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TreesitterVulnAutofixService {
  private readonly logger = new Logger(TreesitterVulnAutofixService.name);

  public suggestFix(code: string): { hasVulnerability: boolean; fixedCode?: string } {
    if (code.includes('eval(')) {
      this.logger.warn('Detected unsafe eval() invocation. Suggesting JSON.parse auto-fix.');
      return {
        hasVulnerability: true,
        fixedCode: code.replace('eval(', 'JSON.parse('),
      };
    }
    return { hasVulnerability: false };
  }
}
