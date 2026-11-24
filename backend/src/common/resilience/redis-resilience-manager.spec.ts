import { RedisResilienceManagerService } from './redis-resilience-manager.service';

describe('RedisResilienceManagerService', () => {
  let manager: RedisResilienceManagerService;

  beforeEach(() => {
    manager = new RedisResilienceManagerService();
  });

  afterEach(() => {
    manager.onModuleDestroy();
  });

  it('should calculate decorrelated jittered backoff within expected bounds', () => {
    const backoff1 = manager.computeNextBackoffMs();
    expect(backoff1).toBeGreaterThanOrEqual(100);
    expect(backoff1).toBeLessThanOrEqual(300);

    const backoff2 = manager.computeNextBackoffMs();
    expect(backoff2).toBeGreaterThanOrEqual(100);
    expect(backoff2).toBeLessThanOrEqual(15000);
  });

  it('should transition to RECONNECTING state on connection loss and reset on reconnect', () => {
    expect(manager.getState()).toBe('ONLINE');

    manager.handleConnectionLoss();
    expect(manager.getState()).toBe('RECONNECTING');
    expect(manager.getReconnectAttempts()).toBe(1);

    manager.handleReconnected();
    expect(manager.getState()).toBe('ONLINE');
    expect(manager.getReconnectAttempts()).toBe(0);
  });

  it('should serve stale data from fallback in-memory cache when Redis is offline', async () => {
    // Prime the fallback cache
    manager.setFallback('user:profile:123', { name: 'Alice', rank: 'Gold' });
    expect(manager.getFallbackSize()).toBe(1);

    // Simulate Redis failure
    manager.handleConnectionLoss();

    const result = await manager.getWithFallback('user:profile:123', async () => {
      throw new Error('ECONNREFUSED 127.0.0.1:6379');
    });

    expect(result.fromFallback).toBe(true);
    expect(result.data).toEqual({ name: 'Alice', rank: 'Gold' });
  });
});
