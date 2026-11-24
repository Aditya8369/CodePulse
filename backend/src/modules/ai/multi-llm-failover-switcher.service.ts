import { Injectable, Logger } from '@nestjs/common';

export type LlmProvider = 'gemini' | 'anthropic' | 'openai';

@Injectable()
export class MultiLlmFailoverSwitcherService {
  private readonly logger = new Logger(MultiLlmFailoverSwitcherService.name);
  private providers: LlmProvider[] = ['gemini', 'anthropic', 'openai'];
  private activeIdx = 0;

  public handleProviderError(failedProvider: LlmProvider): LlmProvider {
    this.logger.warn(`LLM provider ${failedProvider} reported failure/rate-limit. Failing over to fallback.`);
    this.activeIdx = (this.activeIdx + 1) % this.providers.length;
    return this.providers[this.activeIdx];
  }

  public getActiveProvider(): LlmProvider {
    return this.providers[this.activeIdx];
  }
}
