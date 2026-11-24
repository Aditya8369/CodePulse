import { Injectable, Logger } from '@nestjs/common';

export interface CircuitStatus {
  isOpen: boolean;
  consecutiveErrors: number;
  cooldownUntil: number;
}

@Injectable()
export class Webhook5xxExponentialCircuitBreakerService {
  private readonly logger = new Logger(Webhook5xxExponentialCircuitBreakerService.name);
  private circuits = new Map<string, CircuitStatus>();

  public recordResponse(endpoint: string, statusCode: number): CircuitStatus {
    let status = this.circuits.get(endpoint) || {
      isOpen: false,
      consecutiveErrors: 0,
      cooldownUntil: 0,
    };

    if (statusCode >= 500) {
      status.consecutiveErrors++;
      const backoffSec = Math.pow(2, status.consecutiveErrors);
      status.cooldownUntil = Date.now() + (backoffSec * 1000);
      status.isOpen = true;
      this.logger.warn(`Endpoint ${endpoint} returned ${statusCode}. Circuit OPEN for ${backoffSec}s`);
    } else {
      status.consecutiveErrors = 0;
      status.isOpen = false;
      status.cooldownUntil = 0;
    }

    this.circuits.set(endpoint, status);
    return status;
  }

  public canDispatch(endpoint: string): boolean {
    const status = this.circuits.get(endpoint);
    if (!status || !status.isOpen) return true;
    if (Date.now() >= status.cooldownUntil) {
      return true; // half-open probe permitted
    }
    return false;
  }
}
