import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PromptInjectionFirewallService {
  private readonly logger = new Logger(PromptInjectionFirewallService.name);
  private readonly jailbreakPatterns = [
    'ignore all previous instructions',
    'system prompt override',
    'you are now in developer mode',
    'disregard safety guidelines',
  ];

  public inspectUserPrompt(prompt: string): { isClean: boolean; matchedPattern?: string } {
    const lower = prompt.toLowerCase();
    for (const pat of this.jailbreakPatterns) {
      if (lower.includes(pat)) {
        this.logger.warn(`PROMPT INJECTION BLOCKED: Detected jailbreak pattern '${pat}'`);
        return { isClean: false, matchedPattern: pat };
      }
    }
    return { isClean: true };
  }
}
