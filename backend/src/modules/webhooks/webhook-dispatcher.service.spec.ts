import { Test, TestingModule } from '@nestjs/testing';
import { WebhookDispatcherService, RETRY_DELAYS_MS } from './webhook-dispatcher.service';
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
});
