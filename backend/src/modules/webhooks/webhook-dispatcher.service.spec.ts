import { Test, TestingModule } from '@nestjs/testing';
import {
  WebhookDispatcherService,
  RETRY_DELAYS_MS,
  EXPONENTIAL_BACKOFF_DELAYS_MS,
  CONSECUTIVE_FAILURE_THRESHOLD,
} from './webhook-dispatcher.service';
import { WebhooksController } from './webhooks.controller';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';
import * as crypto from 'crypto';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WebhookDispatcherService & WebhooksController', () => {
  let service: WebhookDispatcherService;
  let controller: WebhooksController;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      webhookSubscription: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      webhookDeliveryLog: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      webhookDelivery: {
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        WebhookDispatcherService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<WebhookDispatcherService>(WebhookDispatcherService);
    controller = module.get<WebhooksController>(WebhooksController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('HMAC-SHA256 Signing', () => {
    it('signs payload with cryptographic HMAC-SHA256 matching sha256 digest', () => {
      const secret = 'whsec_testsecret1234567890';
      const payload = { event: 'battle.ended', winnerId: 'usr-1', score: 100 };

      const signature = service.generateHmacSignature(payload, secret);
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature).toHaveLength(64); // SHA-256 hex length

      // Verify HMAC matches manual calculation
      const expected = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload), 'utf8')
        .digest('hex');

      expect(signature).toBe(expected);
    });

    it('generates different signatures for different secrets or payloads', () => {
      const sig1 = service.generateHmacSignature({ msg: 'hello' }, 'secret1');
      const sig2 = service.generateHmacSignature({ msg: 'hello' }, 'secret2');
      const sig3 = service.generateHmacSignature({ msg: 'world' }, 'secret1');

      expect(sig1).not.toBe(sig2);
      expect(sig1).not.toBe(sig3);
    });
  });

  describe('Exponential Backoff & Retry Intervals with Jitter', () => {
    it('schedules retry intervals according to 1m, 5m, 15m, 1h, 6h blueprint', () => {
      expect(RETRY_DELAYS_MS).toEqual([
        60 * 1000,
        5 * 60 * 1000,
        15 * 60 * 1000,
        60 * 60 * 1000,
        6 * 60 * 60 * 1000,
      ]);

      // Without jitter
      expect(service.calculateNextRetryDelay(0, false)).toBe(60 * 1000);
      expect(service.calculateNextRetryDelay(1, false)).toBe(5 * 60 * 1000);
      expect(service.calculateNextRetryDelay(2, false)).toBe(15 * 60 * 1000);
      expect(service.calculateNextRetryDelay(3, false)).toBe(60 * 60 * 1000);
      expect(service.calculateNextRetryDelay(4, false)).toBe(6 * 60 * 60 * 1000);
    });

    it('adds jitter within +/- 15% range', () => {
      const delayWithJitter = service.calculateNextRetryDelay(0, true);
      const baseDelay = 60 * 1000;
      expect(delayWithJitter).toBeGreaterThanOrEqual(baseDelay * 0.84);
      expect(delayWithJitter).toBeLessThanOrEqual(baseDelay * 1.16);
    });
  });

  describe('Webhook Delivery & Success Flow', () => {
    it('dispatches webhook and updates delivery log with success 200 and latency', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { received: true },
      });

      prismaMock.webhookDeliveryLog.update.mockResolvedValueOnce({
        id: 'del-1',
        status: 'SUCCESS',
      });

      const res = await service.executeDelivery(
        'sub-1',
        'del-1',
        'https://example.com/webhook',
        'whsec_abc123',
        'battle.ended',
        { matchId: 'm1' },
        0,
      );

      expect(res.success).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res.latencyMs).toBeGreaterThanOrEqual(0);

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const [url, body, config] = mockedAxios.post.mock.calls[0];
      expect(url).toBe('https://example.com/webhook');
      expect(config?.headers?.['X-CodePulse-Signature']).toBeDefined();
      expect(config?.headers?.['X-CodePulse-Event']).toBe('battle.ended');

      expect(prismaMock.webhookDeliveryLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'del-1' },
          data: expect.objectContaining({
            status: 'SUCCESS',
            statusCode: 200,
          }),
        }),
      );
    });
  });

  describe('Retry Scheduling & Dead-Letter Queue (DLQ)', () => {
    it('schedules RETRYING when attempt count is below 5', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        message: 'connect ETIMEDOUT',
        response: { status: 504, data: 'Gateway Timeout' },
      });

      prismaMock.webhookDeliveryLog.update.mockResolvedValueOnce({
        id: 'del-retry-1',
        status: 'RETRYING',
      });

      const res = await service.executeDelivery(
        'sub-1',
        'del-retry-1',
        'https://example.com/webhook',
        'whsec_abc123',
        'pr.reviewed',
        { prId: 'pr-99' },
        0, // Attempt #1 (index 0)
      );

      expect(res.success).toBe(false);
      expect(res.statusCode).toBe(504);

      expect(prismaMock.webhookDeliveryLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'del-retry-1' },
          data: expect.objectContaining({
            status: 'RETRYING',
            attemptCount: 1,
            isDeadLetter: false,
          }),
        }),
      );
    });

    it('routes permanently failed delivery to Dead-Letter Queue (DLQ) after 5 attempts', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        message: 'Endpoint unreachable 500',
        response: { status: 500, data: 'Internal Server Error' },
      });

      prismaMock.webhookDeliveryLog.update.mockResolvedValueOnce({
        id: 'del-dlq-1',
        status: 'DEAD_LETTER',
      });

      const res = await service.executeDelivery(
        'sub-1',
        'del-dlq-1',
        'https://example.com/webhook',
        'whsec_abc123',
        'badge.awarded',
        { badge: 'code-ninja' },
        4, // 5th attempt (attemptCount 4 + 1 = 5)
      );

      expect(res.success).toBe(false);
      expect(prismaMock.webhookDeliveryLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'del-dlq-1' },
          data: expect.objectContaining({
            status: 'DEAD_LETTER',
            attemptCount: 5,
            isDeadLetter: true,
            dlqReason: expect.stringContaining('Exhausted 5 delivery attempts'),
          }),
        }),
      );
    });
  });

  describe('One-Click Redelivery Replay', () => {
    it('replays failed or DLQ webhook reset attempt counter', async () => {
      prismaMock.webhookDeliveryLog.findUnique.mockResolvedValueOnce({
        id: 'del-dlq-1',
        subscriptionId: 'sub-1',
        event: 'battle.ended',
        payload: { battleId: 'b-1' },
        subscription: {
          url: 'https://example.com/webhook',
          secret: 'whsec_123',
        },
      });

      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: 'OK',
      });

      prismaMock.webhookDeliveryLog.update.mockResolvedValue({
        id: 'del-dlq-1',
        status: 'SUCCESS',
      });

      const res = await service.redeliverWebhook('del-dlq-1');
      expect(res.success).toBe(true);
      expect(res.statusCode).toBe(200);

      expect(prismaMock.webhookDeliveryLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'del-dlq-1' },
          data: expect.objectContaining({
            status: 'PENDING',
            isDeadLetter: false,
          }),
        }),
      );
    });
  });

  describe('Controller API Endpoints', () => {
    it('creates, lists, and queries subscriptions and DLQ entries', async () => {
      prismaMock.webhookSubscription.create.mockResolvedValueOnce({
        id: 'sub-new',
        url: 'https://webhook.site/test',
        events: ['battle.ended'],
      });

      const created = await controller.createSubscription({
        url: 'https://webhook.site/test',
        events: ['battle.ended'],
      });
      expect(created.id).toBe('sub-new');

      prismaMock.webhookDeliveryLog.findMany.mockResolvedValueOnce([
        { id: 'dlq-1', isDeadLetter: true },
      ]);

      const dlq = await controller.getDeadLetterQueue();
      expect(dlq).toHaveLength(1);
      expect(dlq[0].isDeadLetter).toBe(true);
    });
  });

  describe('Global Webhook Dispatcher with Exponential Backoff & HMAC (#378)', () => {
    it('signs outbound request with X-CodePulse-Signature: sha256=... header', async () => {
      mockedAxios.post.mockResolvedValueOnce({ status: 200, data: 'OK' });
      prismaMock.webhookDeliveryLog.update.mockResolvedValueOnce({});
      prismaMock.webhookSubscription.update.mockResolvedValueOnce({});

      await service.executeDelivery(
        'sub-hmac',
        'del-hmac',
        'https://api.mycorp.com/hooks',
        'whsec_mysecretkey',
        'battle.ended',
        { score: 100 },
        0,
      );

      const [url, body, config] = mockedAxios.post.mock.calls[0];
      const signatureHeader = config?.headers?.['X-CodePulse-Signature'];
      expect(signatureHeader).toBeDefined();
      expect(signatureHeader).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it('defines exponential backoff retry schedule for BullMQ queue (10s, 30s, 2m, 10m)', () => {
      expect(EXPONENTIAL_BACKOFF_DELAYS_MS).toEqual([
        10 * 1000,
        30 * 1000,
        2 * 60 * 1000,
        10 * 60 * 1000,
      ]);
      expect(service.calculateQueueBackoffDelay(0)).toBe(10_000);
      expect(service.calculateQueueBackoffDelay(1)).toBe(30_000);
      expect(service.calculateQueueBackoffDelay(2)).toBe(120_000);
      expect(service.calculateQueueBackoffDelay(3)).toBe(600_000);
    });

    it('automatically disables endpoint after 50 consecutive delivery failures', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        message: 'Endpoint unreachable 503',
        response: { status: 503 },
      });

      // Mock subscription with 49 previous failures
      prismaMock.webhookSubscription.findUnique.mockResolvedValueOnce({
        id: 'sub-dead',
        consecutiveFailures: 49,
      });
      prismaMock.webhookSubscription.update.mockResolvedValueOnce({});
      prismaMock.webhookDeliveryLog.update.mockResolvedValueOnce({});

      await service.executeDelivery(
        'sub-dead',
        'del-dead-50',
        'https://dead-endpoint.com/hook',
        'whsec_secret',
        'battle.ended',
        { error: true },
        0,
      );

      // 50th failure -> auto-deactivates
      expect(prismaMock.webhookSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-dead' },
          data: expect.objectContaining({
            consecutiveFailures: 50,
            isActive: false,
            status: 'DISABLED',
          }),
        }),
      );
    });

    it('resets consecutiveFailures to 0 on successful delivery', async () => {
      mockedAxios.post.mockResolvedValueOnce({ status: 200, data: 'OK' });
      prismaMock.webhookDeliveryLog.update.mockResolvedValueOnce({});
      prismaMock.webhookSubscription.update.mockResolvedValueOnce({});

      await service.executeDelivery(
        'sub-healthy',
        'del-healthy',
        'https://healthy.com/hook',
        'whsec_secret',
        'badge.awarded',
        { badge: 'first-place' },
        0,
      );

      expect(prismaMock.webhookSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-healthy' },
          data: expect.objectContaining({
            consecutiveFailures: 0,
          }),
        }),
      );
    });

    it('exposes POST /api/v1/webhooks, GET /api/v1/webhooks, and POST /api/v1/webhooks/:id/test', async () => {
      prismaMock.webhookSubscription.create.mockResolvedValueOnce({
        id: 'sub-rest',
        url: 'https://test.com/hook',
        events: ['*'],
        isActive: true,
      });
      prismaMock.webhookSubscription.findMany.mockResolvedValueOnce([
        { id: 'sub-rest', url: 'https://test.com/hook', isActive: true },
      ]);
      prismaMock.webhookSubscription.findUnique.mockResolvedValueOnce({
        id: 'sub-rest',
        url: 'https://test.com/hook',
        secret: 'whsec_test',
        events: ['*'],
        isActive: true,
      });

      mockedAxios.post.mockResolvedValueOnce({ status: 200, data: 'pong' });
      prismaMock.webhookDeliveryLog.update.mockResolvedValueOnce({});

      const created = await controller.createWebhook({
        url: 'https://test.com/hook',
        events: ['*'],
      });
      expect(created.id).toBe('sub-rest');

      const list = await controller.listWebhooks();
      expect(list).toHaveLength(1);

      const testResult = await controller.testEndpoint('sub-rest');
      expect(testResult.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test.com/hook',
        expect.stringContaining('CodePulse webhook test ping'),
        expect.anything(),
      );
    });
  });
});
