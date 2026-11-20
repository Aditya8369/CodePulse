import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

type QueryEvent = { duration: number; query: string; params: string };
type QueryListener = (event: QueryEvent) => void;

jest.mock('@prisma/client', () => ({
  PrismaClient: class {
    queryListener?: QueryListener;
    options: unknown;

    constructor(options: unknown) {
      this.options = options;
    }

    $on(event: string, listener: QueryListener) {
      if (event === 'query') this.queryListener = listener;
    }

    async $connect() {}
    async $disconnect() {}
  },
}));

function listenerFor(service: PrismaService): QueryListener {
  const listener = (service as unknown as { queryListener?: QueryListener })
    .queryListener;
  if (!listener) throw new Error('Prisma query listener was not registered');
  return listener;
}

describe('PrismaService slow query logging', () => {
  const originalThreshold = process.env.SLOW_QUERY_THRESHOLD_MS;
  let warn: jest.SpyInstance;
  let warnings: string[];

  beforeEach(() => {
    delete process.env.SLOW_QUERY_THRESHOLD_MS;
    warnings = [];
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation((message: unknown) => {
        warnings.push(String(message));
      });
  });

  afterEach(() => {
    if (originalThreshold === undefined)
      delete process.env.SLOW_QUERY_THRESHOLD_MS;
    else process.env.SLOW_QUERY_THRESHOLD_MS = originalThreshold;
    warn.mockRestore();
  });

  it('subscribes to query events and warns only above the 200 ms default', () => {
    const service = new PrismaService();
    expect((service as unknown as { options: unknown }).options).toEqual({
      log: [{ emit: 'event', level: 'query' }],
    });

    const emit = listenerFor(service);
    const query = 'SELECT * FROM "User" WHERE id = $1';
    emit({ duration: 199, query, params: '["private-id"]' });
    emit({ duration: 200, query, params: '["private-id"]' });
    expect(warn).not.toHaveBeenCalled();

    emit({ duration: 201, query, params: '["private-id"]' });
    expect(warn).toHaveBeenCalledTimes(1);
    const log = JSON.parse(warnings[0]) as Record<string, unknown>;
    expect(log).toMatchObject({
      event: 'slow_prisma_query',
      durationMs: 201,
      thresholdMs: 200,
      query,
      params: '[REDACTED]',
      parameterCount: 1,
    });
    expect(warnings[0]).not.toContain('private-id');
  });

  it('uses a configured threshold and tolerates provider-specific parameter serialization', () => {
    process.env.SLOW_QUERY_THRESHOLD_MS = '500';
    const emit = listenerFor(new PrismaService());

    emit({ duration: 400, query: 'SELECT 1', params: 'not-json' });
    expect(warn).not.toHaveBeenCalled();
    emit({ duration: 501, query: 'SELECT 1', params: 'not-json' });
    expect(JSON.parse(warnings[0]) as Record<string, unknown>).toMatchObject({
      thresholdMs: 500,
      parameterCount: null,
      params: '[REDACTED]',
    });
  });
});
