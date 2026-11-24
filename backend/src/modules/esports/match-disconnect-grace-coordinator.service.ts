import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MatchDisconnectGraceCoordinatorService {
  private readonly logger = new Logger(MatchDisconnectGraceCoordinatorService.name);
  private disconnects = new Map<string, number>();

  public onDisconnect(playerId: string, timestamp = Date.now()): void {
    this.disconnects.set(playerId, timestamp);
    this.logger.warn(`Player ${playerId} disconnected. Grace period timer started.`);
  }

  public onReconnect(playerId: string): boolean {
    return this.disconnects.delete(playerId);
  }

  public shouldForfeit(playerId: string, maxGraceSec = 180, currentTime = Date.now()): boolean {
    const dcTime = this.disconnects.get(playerId);
    if (!dcTime) return false;
    return (currentTime - dcTime) >= (maxGraceSec * 1000);
  }
}
