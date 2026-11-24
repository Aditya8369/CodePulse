import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AiStreamingBackpressureInterceptorService {
  private readonly logger = new Logger(AiStreamingBackpressureInterceptorService.name);
  private readonly maxBufferedTokens = 50;

  public canEmitToken(clientBufferDepth: number): boolean {
    if (clientBufferDepth > this.maxBufferedTokens) {
      this.logger.warn('Client WebSocket buffer backpressure detected. Pausing LLM stream.');
      return false;
    }
    return true;
  }
}
