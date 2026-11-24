import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AlertWebhookDedupQueueService {
  private readonly logger = new Logger(AlertWebhookDedupQueueService.name);
  private deliveredFingerprints = new Set<string>();

  public shouldDispatchAlert(alertFingerprint: string): boolean {
    if (this.deliveredFingerprints.has(alertFingerprint)) {
      this.logger.warn(`Alert webhook deduplicated: fingerprint '${alertFingerprint}' already dispatched.`);
      return false;
    }
    this.deliveredFingerprints.add(alertFingerprint);
    return true;
  }
}
