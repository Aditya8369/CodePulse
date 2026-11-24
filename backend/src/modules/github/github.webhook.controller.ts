import { MultiAgentReviewerService } from '../ai/agents/pr-reviewer.service';
import {
  Controller,
  Post,
  Get,
  Headers,
  Body,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  Logger,
  Optional,
  OnModuleInit,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import * as crypto from 'crypto';
import { GithubWebhookService } from './github.webhook.service';
import { DoraMetricsService } from '../analytics/dora-metrics.service';
import { EventBridgeService } from '../messaging/event-bridge.service';

@ApiTags('github-webhooks')
@Controller('api/v1/github/webhooks')
export class GithubWebhookController implements OnModuleInit {
  private readonly logger = new Logger(GithubWebhookController.name);
  private readonly webhookSecret =
    process.env.GITHUB_WEBHOOK_SECRET || 'codepulse-webhook-secret';

  constructor(
    private readonly webhookService: GithubWebhookService,
    @Optional() private readonly multiAgentReviewer?: MultiAgentReviewerService,
    @Optional() private readonly doraMetrics?: DoraMetricsService,
    @Optional() private readonly eventBridge?: EventBridgeService,
  ) {}

  onModuleInit() {
    // Connect consumer group to asynchronous event processing pipeline (#373)
    if (this.eventBridge) {
      this.eventBridge.registerHandler(async (envelope) => {
        return this.processDispatchedEvent(envelope.event, envelope.payload);
      });
      this.logger.log('Asynchronous Webhook EventBridge consumer worker registered.');
    }
  }

  private verifySignature(payload: string, signature: string): boolean {
    if (!signature) return false;
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    const digest = `sha256=${hmac.update(payload).digest('hex')}`;
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
    } catch {
      return false;
    }
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'High-throughput async webhook ingestion bridge for GitHub events (#373)',
    description:
      'Validates HMAC signature and immediately acknowledges GitHub with HTTP 202 Accepted in < 15ms, queueing events in events.webhooks.raw for parallel in-order batch consumption.',
  })
  @ApiResponse({ status: 202, description: 'Webhook accepted and queued for asynchronous processing' })
  @ApiResponse({ status: 200, description: 'Webhook processed synchronously (fallback mode)' })
  async handleWebhook(
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') event: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Body() body: any,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<any> {
    const rawPayload = JSON.stringify(body);

    // Validate HMAC signature (reject if signature missing or invalid)
    if (!signature || !this.verifySignature(rawPayload, signature)) {
      this.logger.warn('GitHub webhook signature mismatch or missing');
      throw new UnauthorizedException('Invalid or missing HMAC signature');
    }

    // Idempotency check: ignore duplicate deliveries via X-GitHub-Delivery GUID tracking
    if (deliveryId && this.webhookService.isDeliveryProcessed(deliveryId)) {
      this.logger.log(`Ignoring duplicate delivery: ${deliveryId}`);
      return { status: 'duplicate_ignored', deliveryId };
    }

    if (deliveryId) {
      this.webhookService.recordDelivery(deliveryId);
    }

    this.logger.log(`Received GitHub webhook event: ${event} (Delivery: ${deliveryId})`);

    // If EventBridge is configured, queue event asynchronously and return HTTP 202 (< 10ms) (#373)
    if (this.eventBridge) {
      const partitionKey =
        body?.repository?.id?.toString() ||
        body?.repository?.full_name ||
        body?.repository?.name ||
        'global';

      const ack = await this.eventBridge.publishWebhookEvent({
        event,
        deliveryId,
        partitionKey,
        signature,
        payload: body,
      });

      if (res) {
        res.status(HttpStatus.ACCEPTED);
      }

      return {
        status: 'accepted',
        message: 'Webhook queued for asynchronous processing',
        deliveryId,
        event,
        partitionKey,
        eventId: ack.eventId,
        latencyMs: ack.latencyMs,
        queuedAt: ack.queuedAt,
      };
    }

    // Fallback: Synchronous processing if bridge is not available
    return this.processDispatchedEvent(event, body);
  }

  /**
   * Internal processor for GitHub webhook events.
   */
  async processDispatchedEvent(event: string, body: any) {
    switch (event) {
      case 'deployment_status': {
        const doraResult = this.doraMetrics?.ingestGithubWebhookEvent('deployment_status', body);
        return { status: 'processed', event: 'deployment_status', dora: doraResult };
      }

      case 'push': {
        this.doraMetrics?.ingestGithubWebhookEvent('push', body);
        const result = await this.webhookService.processPushEvent(body);
        return { status: 'processed', event: 'push', ...result };
      }

      case 'pull_request': {
        const result = await this.webhookService.processPullRequestEvent(body);
        return { status: 'processed', event: 'pull_request', ...result };
      }

      case 'star': {
        const result = await this.webhookService.processStarEvent(body);
        return { status: 'processed', event: 'star', ...result };
      }

      case 'release': {
        this.doraMetrics?.ingestGithubWebhookEvent('release', body);
        const result = await this.webhookService.processReleaseEvent(body);
        return { status: 'processed', event: 'release', ...result };
      }

      case 'issues': {
        const result = await this.webhookService.processIssuesEvent(body);
        return { status: 'processed', event: 'issues', ...result };
      }

      case 'ping':
        return { status: 'pong', zen: body?.zen };

      default:
        this.logger.debug(`Unhandled GitHub event: ${event}`);
        return { status: 'ignored', event };
    }
  }

  @Get('bridge/metrics')
  @ApiOperation({ summary: 'Retrieve event ingestion bridge metrics and Prometheus format (#373)' })
  async getBridgeMetrics(@Res({ passthrough: true }) res?: Response) {
    if (!this.eventBridge) {
      return { enabled: false, message: 'EventBridgeService is not active.' };
    }
    return this.eventBridge.getMetrics();
  }

  @Post('bridge/replay')
  @ApiOperation({ summary: 'Replay failed dead-letter webhook messages (#373)' })
  async replayFailedWebhooks(
    @Body() body: { partitionKey?: string; eventType?: string; limit?: number },
  ) {
    if (!this.eventBridge) {
      return { replayedCount: 0, message: 'EventBridgeService is not active.' };
    }
    return this.eventBridge.replayFailedEvents(body);
  }

  async handlePullRequestWebhookEvent(payload: any) {
    const action = payload?.action;
    if (action !== 'opened' && action !== 'synchronize') {
      return { ignored: true, reason: `Unsupported action ${action}` };
    }
    if (!this.multiAgentReviewer) {
      return { processed: true, prNumber: payload?.pull_request?.number };
    }
    return this.multiAgentReviewer.reviewPullRequestWebhook({
      eventAction: action,
      prNumber: payload?.pull_request?.number ?? 0,
      authorLogin: payload?.pull_request?.user?.login ?? 'unknown',
      authorType: payload?.pull_request?.user?.type ?? 'User',
      labels: (payload?.pull_request?.labels ?? []).map((l: any) => l?.name ?? String(l)),
      diffContent: payload?.diff ?? '',
      filesChanged: payload?.filesChanged ?? ['src/app.ts'],
    });
  }
}
