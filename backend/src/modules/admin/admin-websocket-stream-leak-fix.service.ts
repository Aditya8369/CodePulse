import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AdminWebsocketStreamLeakFixService {
  private readonly logger = new Logger(AdminWebsocketStreamLeakFixService.name);
  private clientListeners = new Map<string, Function>();

  public registerClientListener(socketId: string, listener: Function): void {
    this.clientListeners.set(socketId, listener);
  }

  public unregisterClientOnDisconnect(socketId: string): boolean {
    if (this.clientListeners.has(socketId)) {
      this.clientListeners.delete(socketId);
      this.logger.log(`Cleaned up listener for disconnected socket ${socketId}.`);
      return true;
    }
    return false;
  }

  public getActiveClientCount(): number {
    return this.clientListeners.size;
  }
}
