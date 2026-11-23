import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import axios from 'axios';
import {
  CreateWebhookSubscriptionDto,
  DispatchWebhookDto,
  UpdateWebhookSubscriptionDto,
} from './dto/webhook.dto';

// Exponential backoff schedule intervals in milliseconds: 1m, 5m, 15m, 1h, 6h
export const RETRY_DELAYS_MS = [
  60 * 1000, // 1 min
  5 * 60 * 1000, // 5 min
  15 * 60 * 1000, // 15 min
  60 * 60 * 1000, // 1 hour
  6 * 60 * 60 * 1000, // 6 hours
];

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  latencyMs: number;
  responseBody?: string;
  error?: string;
}

@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates cryptographic HMAC-SHA256 signature for outgoing webhook payload
   */
  public generateHmacSignature(payload: string | Record<string, unknown>, secret: string): string {
    const rawPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(rawPayload, 'utf8')
      .digest('hex');
  }

  /**
   * Calculates exponential backoff delay with jitter (attempts at 1m, 5m, 15m, 1h, 6h)
   */
  public calculateNextRetryDelay(attemptIndex: number, withJitter = true): number {
    const clampedIndex = Math.min(attemptIndex, RETRY_DELAYS_MS.length - 1);
    const baseDelay = RETRY_DELAYS_MS[clampedIndex];

    if (!withJitter) return baseDelay;

    // Add +/- 15% random jitter to avoid thundering herd
    const jitterFactor = 0.85 + Math.random() * 0.3;
    return Math.floor(baseDelay * jitterFactor);
  }

  /**
   * Create new webhook subscription
   */
  public async createSubscription(userId: string | undefined, dto: CreateWebhookSubscriptionDto) {
    const secret = dto.secret || `whsec_${crypto.randomBytes(24).toString('hex')}`;
    return this.prisma.webhookSubscription.create({
      data: {
        userId,
        url: dto.url,
        secret,
        description: dto.description,
        events: dto.events,
      },
    });
  }

  /**
   * List all subscriptions for a user
   */
  public async listSubscriptions(userId?: string) {
    return this.prisma.webhookSubscription.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { deliveries: true },
        },
      },
    });
  }

  /**
   * Get single subscription
   */
  public async getSubscription(id: string) {
    const sub = await this.prisma.webhookSubscription.findUnique({
      where: { id },
      include: {
        deliveries: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!sub) throw new NotFoundException(`Webhook subscription ${id} not found`);
    return sub;
  }

  /**
   * Update subscription
   */
  public async updateSubscription(id: string, dto: UpdateWebhookSubscriptionDto) {
    await this.getSubscription(id);
    return this.prisma.webhookSubscription.update({
      where: { id },
      data: {
        url: dto.url,
        secret: dto.secret,
        description: dto.description,
        events: dto.events,
        status: dto.status,
      },
    });
  }

  /**
   * Delete subscription
   */
  public async deleteSubscription(id: string) {
    await this.getSubscription(id);
    return this.prisma.webhookSubscription.delete({ where: { id } });
  }

  /**
   * Dispatches an event to all matching active webhook subscriptions
   */
  public async dispatchEvent(dto: DispatchWebhookDto, userId?: string) {
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      where: {
        status: 'ACTIVE',
        ...(userId ? { userId } : {}),
      },
    });

    const matchingSubs = subscriptions.filter(
      (sub) => sub.events.includes('*') || sub.events.includes(dto.event),
    );

    const deliveryPromises = matchingSubs.map(async (sub) => {
      // Create initial delivery record
      const delivery = await this.prisma.webhookDeliveryLog.create({
        data: {
          subscriptionId: sub.id,
          event: dto.event,
          payload: dto.payload as any,
          status: 'PENDING',
          attemptCount: 0,
          maxAttempts: 5,
        },
      });

      return this.executeDelivery(sub.id, delivery.id, sub.url, sub.secret, dto.event, dto.payload, 0);
    });

    return Promise.all(deliveryPromises);
  }

  /**
   * Executes HTTP POST delivery with HMAC signature and handles retries / DLQ
   */
  public async executeDelivery(
    subscriptionId: string,
    deliveryId: string,
    url: string,
    secret: string,
    event: string,
    payload: Record<string, unknown>,
    attemptCount: number,
  ): Promise<WebhookDeliveryResult> {
    const currentAttempt = attemptCount + 1;
    const bodyString = JSON.stringify({
      id: deliveryId,
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    const signature = this.generateHmacSignature(bodyString, secret);

    const startTime = Date.now();
    let result: WebhookDeliveryResult;

    try {
      const response = await axios.post(url, bodyString, {
        headers: {
          'Content-Type': 'application/json',
          'X-CodePulse-Signature': signature,
          'X-CodePulse-Event': event,
          'X-CodePulse-Delivery': deliveryId,
          'User-Agent': 'CodePulse-Webhook-Dispatcher/1.0',
        },
        timeout: 10000,
      });

      const latencyMs = Date.now() - startTime;
      const isSuccess = response.status >= 200 && response.status < 300;

      result = {
        success: isSuccess,
        statusCode: response.status,
        latencyMs,
        responseBody: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const statusCode = err.response?.status;
      const responseBody = err.response?.data
        ? (typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data))
        : undefined;

      result = {
        success: false,
        statusCode,
        latencyMs,
        responseBody,
        error: err.message || 'Network delivery failure',
      };
    }

    // Update log state in database
    if (result.success) {
      await this.prisma.webhookDeliveryLog.update({
        where: { id: deliveryId },
        data: {
          status: 'SUCCESS',
          statusCode: result.statusCode,
          latencyMs: result.latencyMs,
          responseBody: result.responseBody?.slice(0, 1000),
          attemptCount: currentAttempt,
          deliveredAt: new Date(),
          isDeadLetter: false,
        },
      });
      this.logger.log(`Webhook delivery ${deliveryId} succeeded [${result.statusCode}] in ${result.latencyMs}ms`);
    } else {
      // Check if attempts exhausted -> send to Dead-Letter Queue (DLQ)
      const maxAttempts = 5;
      if (currentAttempt >= maxAttempts) {
        await this.prisma.webhookDeliveryLog.update({
          where: { id: deliveryId },
          data: {
            status: 'DEAD_LETTER',
            statusCode: result.statusCode,
            latencyMs: result.latencyMs,
            responseBody: result.responseBody?.slice(0, 1000),
            error: result.error,
            attemptCount: currentAttempt,
            isDeadLetter: true,
            dlqReason: `Exhausted ${maxAttempts} delivery attempts. Last error: ${result.error}`,
          },
        });
        this.logger.error(`Webhook delivery ${deliveryId} moved to DLQ after ${currentAttempt} attempts`);
      } else {
        // Schedule next retry with exponential backoff & jitter
        const delayMs = this.calculateNextRetryDelay(currentAttempt - 1);
        const nextRetryAt = new Date(Date.now() + delayMs);

        await this.prisma.webhookDeliveryLog.update({
          where: { id: deliveryId },
          data: {
            status: 'RETRYING',
            statusCode: result.statusCode,
            latencyMs: result.latencyMs,
            responseBody: result.responseBody?.slice(0, 1000),
            error: result.error,
            attemptCount: currentAttempt,
            nextRetryAt,
            isDeadLetter: false,
          },
        });
        this.logger.warn(`Webhook delivery ${deliveryId} failed. Retry #${currentAttempt} scheduled at ${nextRetryAt.toISOString()}`);
      }
    }

    return result;
  }

  /**
   * One-click redelivery of a failed or DLQ webhook delivery
   */
  public async redeliverWebhook(deliveryId: string) {
    const delivery = await this.prisma.webhookDeliveryLog.findUnique({
      where: { id: deliveryId },
      include: { subscription: true },
    });

    if (!delivery) throw new NotFoundException(`Delivery record ${deliveryId} not found`);

    // Reset DLQ status and attempt count for manual replay
    await this.prisma.webhookDeliveryLog.update({
      where: { id: deliveryId },
      data: {
        status: 'PENDING',
        isDeadLetter: false,
        dlqReason: null,
        error: null,
      },
    });

    return this.executeDelivery(
      delivery.subscriptionId,
      delivery.id,
      delivery.subscription.url,
      delivery.subscription.secret,
      delivery.event,
      delivery.payload as Record<string, unknown>,
      0, // restart attempt count
    );
  }

  /**
   * Move failed delivery explicitly to Dead Letter Queue
   */
  public async moveToDeadLetterQueue(deliveryId: string, errorReason: string) {
    if (!this.prisma?.webhookDeliveryLog) return;
    try {
      await this.prisma.webhookDeliveryLog.update({
        where: { id: deliveryId },
        data: {
          status: 'DEAD_LETTER',
          isDeadLetter: true,
          dlqReason: errorReason,
          error: errorReason,
        },
      });
    } catch {
      // non-blocking
    }
  }

  /**
   * Get Dead-Letter Queue (DLQ) entries
   */
  public async getDeadLetterQueue(userId?: string) {
    return this.prisma.webhookDeliveryLog.findMany({
      where: {
        isDeadLetter: true,
        ...(userId ? { subscription: { userId } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        subscription: true,
      },
    });
  }

  /**
   * Get delivery logs for a subscription or overall dashboard
   */
  public async getDeliveryLogs(subscriptionId?: string, limit = 50) {
    return this.prisma.webhookDeliveryLog.findMany({
      where: subscriptionId ? { subscriptionId } : {},
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: true,
      },
    });
  }
}
