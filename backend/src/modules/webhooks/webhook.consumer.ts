import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import axios from 'axios';
import { WebhookDispatcherService } from './webhook-dispatcher.service';

export interface WebhookDeliveryJobData {
  deliveryId: string;
  subscriptionId: string;
  targetUrl: string;
  secret: string;
  event: string;
  payload: Record<string, any>;
  attempt: number;
}

@Processor('webhook-delivery')
export class WebhookConsumer extends WorkerHost {
  private readonly logger = new Logger(WebhookConsumer.name);

  constructor(private readonly dispatcher: WebhookDispatcherService) {
    super();
  }

  async process(job: Job<WebhookDeliveryJobData>): Promise<any> {
    const { deliveryId, targetUrl, secret, event, payload, attempt } = job.data;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.dispatcher.generateHmacSignature(
      `${timestamp}.${JSON.stringify(payload)}`,
      secret,
    );

    try {
      this.logger.log(
        `Dispatching webhook delivery ${deliveryId} (attempt ${attempt + 1}/5) to ${targetUrl}`,
      );

      const res = await axios.post(targetUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-CodePulse-Event': event,
          'X-CodePulse-Delivery': deliveryId,
          'X-CodePulse-Timestamp': String(timestamp),
          'X-CodePulse-Signature': `sha256=${signature}`,
          'User-Agent': 'CodePulse-Webhook-Dispatcher/1.0',
        },
        timeout: 5000,
      });

      this.logger.log(`Webhook delivery ${deliveryId} succeeded with HTTP ${res.status}`);
      return { success: true, statusCode: res.status };
    } catch (err: any) {
      const nextAttempt = attempt + 1;
      const errorMsg = err.response?.status
        ? `HTTP ${err.response.status}: ${err.response.statusText}`
        : err.message;

      this.logger.warn(`Webhook delivery ${deliveryId} failed: ${errorMsg}`);

      if (nextAttempt >= 5) {
        this.logger.error(
          `Max retries exceeded for delivery ${deliveryId}. Moving to Dead Letter Queue (DLQ).`,
        );
        this.dispatcher.moveToDeadLetterQueue(deliveryId, errorMsg);
        return { success: false, movedToDlq: true, error: errorMsg };
      }

      // Re-throw to trigger BullMQ exponential backoff
      throw new Error(`Webhook delivery attempt ${nextAttempt} failed: ${errorMsg}`);
    }
  }
}
