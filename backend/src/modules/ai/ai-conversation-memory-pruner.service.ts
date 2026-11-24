import { Injectable, Logger } from '@nestjs/common';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

@Injectable()
export class AiConversationMemoryPrunerService {
  private readonly logger = new Logger(AiConversationMemoryPrunerService.name);
  private readonly maxRetainedTurns = 6;

  public pruneHistory(messages: ChatMessage[]): ChatMessage[] {
    const system = messages.filter((m) => m.role === 'system');
    const nonSystem = messages.filter((m) => m.role !== 'system');

    if (nonSystem.length > this.maxRetainedTurns) {
      this.logger.log(`Pruned conversation history from ${nonSystem.length} to ${this.maxRetainedTurns} turns.`);
      return [...system, ...nonSystem.slice(-this.maxRetainedTurns)];
    }
    return messages;
  }
}
