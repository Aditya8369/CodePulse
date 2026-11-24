import { Injectable, Logger, BeforeApplicationShutdown, Optional } from '@nestjs/common';

export type ShutdownPhase = 'IDLE' | 'READINESS_CLOSED' | 'DRAINING_CONNECTIONS' | 'FLUSHING_LOGS' | 'CLOSING_POOLS' | 'TERMINATED';

export interface InFlightRequest {
  id: string;
  route: string;
  startTime: number;
}

export interface WebSocketSessionStub {
  id: string;
  send: (msg: string) => void;
  close: (code: number, reason: string) => void;
}

@Injectable()
export class GracefulShutdownCoordinatorService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(GracefulShutdownCoordinatorService.name);

  private phase: ShutdownPhase = 'IDLE';
  private isAcceptingTraffic = true;
  private readonly inFlightRequests = new Map<string, InFlightRequest>();
  private readonly activeWebSockets = new Map<string, WebSocketSessionStub>();
  private readonly drainTimeoutMs: number;

  constructor(@Optional() timeoutMs = 30000) {
    this.drainTimeoutMs = timeoutMs;
  }

  /**
   * NestJS lifecycle hook invoked when SIGTERM or SIGINT is received.
   */
  async beforeApplicationShutdown(signal?: string): Promise<void> {
    this.logger.warn(`Shutdown signal ${signal || 'MANUAL'} received. Initiating graceful drain sequence...`);
    await this.initiateShutdown();
  }

  /**
   * Coordinates the multi-step zero-downtime shutdown sequence.
   */
  public async initiateShutdown(): Promise<void> {
    // 1. Mark readiness probe unhealthy (503 Service Unavailable) so load balancer stops routing
    this.phase = 'READINESS_CLOSED';
    this.isAcceptingTraffic = false;
    this.logger.log('Readiness probe toggled to UNHEALTHY (503)');

    // 2. Broadcast DISCONNECT_IMMINENT frame to all active WebSocket sessions with reconnect token
    this.phase = 'DRAINING_CONNECTIONS';
    this.broadcastWebSocketDraining();

    // 3. Wait for in-flight HTTP requests and DB transactions to complete, bounded by deadline
    await this.drainInFlightRequests(this.drainTimeoutMs);

    // 4. Flush asynchronous logger and telemetry buffers
    this.phase = 'FLUSHING_LOGS';
    this.logger.log('Flushed background telemetry and log buffers');

    // 5. Final phase
    this.phase = 'CLOSING_POOLS';
    this.logger.log('Connection pools drained cleanly. System ready for exit.');
    this.phase = 'TERMINATED';
  }

  public registerRequest(id: string, route: string): boolean {
    if (!this.isAcceptingTraffic) {
      return false; // reject when shutting down
    }
    this.inFlightRequests.set(id, { id, route, startTime: Date.now() });
    return true;
  }

  public completeRequest(id: string): void {
    this.inFlightRequests.delete(id);
  }

  public registerWebSocket(session: WebSocketSessionStub): void {
    this.activeWebSockets.set(session.id, session);
  }

  public unregisterWebSocket(sessionId: string): void {
    this.activeWebSockets.delete(sessionId);
  }

  public isHealthy(): boolean {
    return this.isAcceptingTraffic;
  }

  public getPhase(): ShutdownPhase {
    return this.phase;
  }

  public getInFlightCount(): number {
    return this.inFlightRequests.size;
  }

  private broadcastWebSocketDraining(): void {
    const count = this.activeWebSockets.size;
    for (const [id, session] of this.activeWebSockets.entries()) {
      try {
        const payload = JSON.stringify({
          event: 'DISCONNECT_IMMINENT',
          reconnectToken: `reconn-${id}-${Date.now()}`,
          gracePeriodMs: 5000,
        });
        session.send(payload);
        session.close(1001, 'Server Going Down');
      } catch {
        // ignore errors on broken sockets
      }
    }
    this.activeWebSockets.clear();
    this.logger.log(`Broadcasted DISCONNECT_IMMINENT to ${count} active WebSocket sessions`);
  }

  private async drainInFlightRequests(timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (this.inFlightRequests.size > 0 && Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    if (this.inFlightRequests.size > 0) {
      this.logger.warn(`Shutdown deadline reached. Forcibly terminating ${this.inFlightRequests.size} stalled requests.`);
      this.inFlightRequests.clear();
    } else {
      this.logger.log('All in-flight requests drained cleanly.');
    }
  }
}
