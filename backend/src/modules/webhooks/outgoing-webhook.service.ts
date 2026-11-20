import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import axios from 'axios';

export interface OutgoingWebhookPayload {
  event: 'battle.completed' | 'challenge.claimed' | 'tier.promoted' | 'streak.milestone';
  data: Record<string, any>;
  timestamp: string;
}

@Injectable()
export class OutgoingWebhookService {
  private readonly logger = new Logger(OutgoingWebhookService.name);

  generateSignature(payload: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    return `sha256=${hmac.update(payload).digest('hex')}`;
  }

  async dispatchWebhook(url: string, secret: string, payload: OutgoingWebhookPayload, maxRetries = 3) {
    const serialized = JSON.stringify(payload);
    const signature = this.generateSignature(serialized, secret);

    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        this.logger.log(`Dispatching webhook [${payload.event}] to ${url} (Attempt ${attempt + 1}/${maxRetries})`);
        const res = await axios.post(url, serialized, {
          headers: {
            'Content-Type': 'application/json',
            'x-codepulse-signature': signature,
            'x-codepulse-event': payload.event,
            'x-codepulse-delivery': `dlv-${Date.now()}`,
          },
          timeout: 5000,
        });

        this.logger.log(`Webhook successfully delivered: Status ${res.status}`);
        return { success: true, statusCode: res.status };
      } catch (err: any) {
        attempt++;
        this.logger.warn(`Webhook attempt ${attempt} failed: ${err.message}`);
        if (attempt >= maxRetries) {
          return { success: false, error: err.message };
        }
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }
}
