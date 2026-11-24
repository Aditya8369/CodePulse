import { LogRateControllerService } from './log-rate-controller.service';
import { AdaptiveLogSamplerService, LogPayload } from './adaptive-log-sampler.service';

describe('AdaptiveLogSamplerService & LogRateControllerService', () => {
  let rateController: LogRateControllerService;
  let logSampler: AdaptiveLogSamplerService;

  beforeEach(() => {
    rateController = new LogRateControllerService();
    logSampler = new AdaptiveLogSamplerService(rateController);
  });

  describe('AdaptiveLogSamplerService signature computation', () => {
    it('should generate identical signatures for errors with differing dynamic line numbers and timestamps', () => {
      const log1: LogPayload = {
        level: 'error',
        statusCode: 500,
        message: 'Database query timeout at 2026-11-24T12:00:00.000Z',
        stack: 'Error at db.service.ts:145:12\n  at async handleRequest (controller.ts:42:8)',
      };

      const log2: LogPayload = {
        level: 'error',
        statusCode: 500,
        message: 'Database query timeout at 2026-11-24T12:00:05.123Z',
        stack: 'Error at db.service.ts:180:99\n  at async handleRequest (controller.ts:50:14)',
      };

      const sig1 = logSampler.computeSignature(log1);
      const sig2 = logSampler.computeSignature(log2);

      expect(sig1).toBe(sig2);
    });

    it('should generate distinct signatures for different error types', () => {
      const log1: LogPayload = { level: 'error', message: 'TypeError: Cannot read properties of undefined' };
      const log2: LogPayload = { level: 'error', message: 'PrismaClientKnownRequestError: Unique constraint failed' };

      expect(logSampler.computeSignature(log1)).not.toBe(logSampler.computeSignature(log2));
    });
  });

  describe('Adaptive rate suppression during incident surges', () => {
    it('should ALWAYS allow the first occurrence of any unique signature', () => {
      const decision = logSampler.evaluate({
        level: 'error',
        message: 'Fatal service panic',
      });

      expect(decision.allow).toBe(true);
      expect(decision.isFirstOccurrence).toBe(true);
      expect(decision.suppressedCountSoFar).toBe(0);
    });

    it('should aggressively sample duplicate errors when volume surges beyond threshold', () => {
      const now = Date.now();
      // Simulate 250 requests in 1 second to trigger SURGE_SUPPRESSION
      for (let i = 0; i < 250; i++) {
        rateController.evaluateRate(now);
      }

      const stats = rateController.getStats();
      expect(stats.tier).toBe('SURGE_SUPPRESSION');
      expect(stats.samplingRatio).toBe(0.10);

      // Now evaluate 50 duplicate log entries
      const errorPayload: LogPayload = {
        level: 'error',
        statusCode: 502,
        message: 'Bad Gateway upstream socket hangup',
      };

      let allowedCount = 0;
      let suppressedCount = 0;

      for (let i = 0; i < 50; i++) {
        const decision = logSampler.evaluate(errorPayload);
        if (decision.allow) {
          allowedCount++;
        } else {
          suppressedCount++;
        }
      }

      // First occurrence allowed + approximately 10% sampled
      expect(suppressedCount).toBeGreaterThan(35);
      expect(rateController.getStats().totalSuppressed).toBe(suppressedCount);
    });
  });
});
