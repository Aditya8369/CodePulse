import { describe, it, expect, beforeEach } from 'vitest';
import { OtelBrowserClient } from './otel-client';

describe('OtelBrowserClient Vitest Suite', () => {
  let client: OtelBrowserClient;

  beforeEach(() => {
    client = new OtelBrowserClient({ serviceName: 'test-frontend' });
  });

  describe('W3C Traceparent Header Parsing & Formatting', () => {
    it('should generate valid 32-char hex traceId and 16-char hex spanId', () => {
      const traceId = client.generateTraceId();
      const spanId = client.generateSpanId();

      expect(traceId).toHaveLength(32);
      expect(spanId).toHaveLength(16);
      expect(/^[0-9a-f]{32}$/.test(traceId)).toBe(true);
      expect(/^[0-9a-f]{16}$/.test(spanId)).toBe(true);
    });

    it('should create and parse valid W3C traceparent headers', () => {
      const traceparent = client.createTraceparent();
      expect(traceparent.startsWith('00-')).toBe(true);

      const parsed = client.parseTraceparent(traceparent);
      expect(parsed).not.toBeNull();
      expect(parsed?.version).toBe('00');
      expect(parsed?.traceId).toHaveLength(32);
      expect(parsed?.spanId).toHaveLength(16);
    });
  });

  describe('Span Lifecycle & User Actions', () => {
    it('should record completed spans with duration and attributes', async () => {
      const result = await client.traceUserAction(
        'button_click_submit_solution',
        { 'ui.component': 'MonacoEditor', 'battle.id': 'battle-101' },
        async ({ traceId, traceparent }) => {
          expect(traceId).toHaveLength(32);
          expect(traceparent).toBeDefined();
          return 'solution_submitted';
        },
      );

      expect(result).toBe('solution_submitted');
      const finished = client.getFinishedSpans();
      expect(finished.length).toBeGreaterThan(0);

      const lastSpan = finished[finished.length - 1];
      expect(lastSpan.name).toBe('button_click_submit_solution');
      expect(lastSpan.status).toBe('OK');
      expect(lastSpan.durationMs).toBeGreaterThanOrEqual(0);
      expect(lastSpan.attributes['ui.component']).toBe('MonacoEditor');
    });

    it('should record ERROR status on exception', async () => {
      await expect(
        client.traceUserAction('failing_action', {}, async () => {
          throw new Error('Simulation failed');
        }),
      ).rejects.toThrow('Simulation failed');

      const finished = client.getFinishedSpans();
      const errorSpan = finished.find((s) => s.name === 'failing_action');
      expect(errorSpan).toBeDefined();
      expect(errorSpan?.status).toBe('ERROR');
      expect(errorSpan?.errorMessage).toBe('Simulation failed');
    });
  });
});
