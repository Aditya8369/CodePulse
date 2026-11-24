import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SandboxedTestValidationHarnessService {
  private readonly logger = new Logger(SandboxedTestValidationHarnessService.name);

  public validateGeneratedSnippet(snippet: string): { passesSyntaxCheck: boolean; error?: string } {
    try {
      new Function(snippet);
      return { passesSyntaxCheck: true };
    } catch (err: any) {
      this.logger.warn(`Generated code syntax error: ${err.message}`);
      return { passesSyntaxCheck: false, error: err.message };
    }
  }
}
