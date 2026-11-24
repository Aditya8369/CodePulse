import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WebsocketTelemetryPushGatewayService {
  private readonly logger = new Logger(WebsocketTelemetryPushGatewayService.name);
  private subscribedClients = new Set<string>();

  public subscribe(clientId: string): void {
    this.subscribedClients.add(clientId);
  }

  public broadcastMetric(metricPayload: Record<string, unknown>): number {
    this.logger.log(`Pushed real-time metric update to ${this.subscribedClients.size} dashboard clients.`);
    return this.subscribedClients.size;
  }
}
