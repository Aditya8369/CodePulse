import { Request, Response, NextFunction } from 'express';
import {
  LoadShedderMiddleware,
  TrafficPriorityTier,
} from './load-shedder.middleware';
import { SystemMetricsService } from '../services/system-metrics.service';

/* eslint-disable @typescript-eslint/unbound-method */

describe('LoadShedderMiddleware', () => {
  let middleware: LoadShedderMiddleware;
  let metricsService: SystemMetricsService;

  beforeEach(() => {
    metricsService = new SystemMetricsService();
    middleware = new LoadShedderMiddleware(metricsService);
  });

  afterEach(() => {
    metricsService.stopSampling();
  });

  const createMockReqRes = (
    url: string,
    headers: Record<string, string> = {},
  ) => {
    const listeners: Record<string, Function[]> = {};

    const req = {
      url,
      originalUrl: url,
      headers,
    } as unknown as Request;

    const resJson = jest.fn();
    const resStatus = jest.fn().mockReturnValue({ json: resJson });
    const resSetHeader = jest.fn();

    const res = {
      status: resStatus,
      setHeader: resSetHeader,
      json: resJson,
      on: jest.fn((event: string, cb: Function) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(cb);
      }),
      removeListener: jest.fn(),
      emit: (event: string) => {
        if (listeners[event]) {
          listeners[event].forEach((cb) => cb());
        }
      },
    } as unknown as Response;

    const next: NextFunction = jest.fn(() => {
      (res as any).emit('finish');
    });

    return { req, res, next, resStatus, resJson, resSetHeader };
  };

  it('should classify traffic priority tiers correctly across all 4 priority bands', () => {
    // 1. CRITICAL
    const wsReq = {
      url: '/battles/socket',
      headers: { upgrade: 'websocket' },
    } as Request;
    expect(middleware.classifyRequestPriority(wsReq)).toBe(
      TrafficPriorityTier.CRITICAL,
    );

    const submitReq = {
      url: '/api/v1/battles/submit',
      headers: {},
    } as Request;
    expect(middleware.classifyRequestPriority(submitReq)).toBe(
      TrafficPriorityTier.CRITICAL,
    );

    const keystrokeReq = {
      url: '/api/v1/battles/keystroke',
      headers: {},
    } as Request;
    expect(middleware.classifyRequestPriority(keystrokeReq)).toBe(
      TrafficPriorityTier.CRITICAL,
    );

    // 2. HIGH
    const authReq = { url: '/api/v1/auth/login', headers: {} } as Request;
    expect(middleware.classifyRequestPriority(authReq)).toBe(
      TrafficPriorityTier.HIGH,
    );

    const matchmakingReq = {
      url: '/api/v1/battles/matchmaking',
      headers: {},
    } as Request;
    expect(middleware.classifyRequestPriority(matchmakingReq)).toBe(
      TrafficPriorityTier.HIGH,
    );

    // 3. NORMAL
    const profileReq = { url: '/api/v1/users/profile', headers: {} } as Request;
    expect(middleware.classifyRequestPriority(profileReq)).toBe(
      TrafficPriorityTier.NORMAL,
    );

    const leaderboardReq = {
      url: '/api/v1/leaderboards/global',
      headers: {},
    } as Request;
    expect(middleware.classifyRequestPriority(leaderboardReq)).toBe(
      TrafficPriorityTier.NORMAL,
    );

    // 4. LOW
    const avatarReq = { url: '/api/v1/users/avatar', headers: {} } as Request;
    expect(middleware.classifyRequestPriority(avatarReq)).toBe(
      TrafficPriorityTier.LOW,
    );

    const analyticsReq = {
      url: '/api/v1/analytics/overview',
      headers: {},
    } as Request;
    expect(middleware.classifyRequestPriority(analyticsReq)).toBe(
      TrafficPriorityTier.LOW,
    );

    const syncReq = { url: '/api/v1/sync/github', headers: {} } as Request;
    expect(middleware.classifyRequestPriority(syncReq)).toBe(
      TrafficPriorityTier.LOW,
    );
  });

  it('should admit all traffic under healthy system metrics (event loop lag < 50ms)', () => {
    metricsService.setSimulatedMetrics(25); // 25ms lag (Green)

    const { req, res, next } = createMockReqRes('/api/v1/sync/github');
    middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();

    const stats = middleware.getStats();
    expect(stats.admittedRequests).toBe(1);
    expect(stats.shedRequests).toBe(0);
    expect(stats.currentSystemHealth).toBe('GREEN');
  });

  it('should shed LOW priority requests with HTTP 503 and Retry-After: 30 when lag >= 50ms', () => {
    metricsService.setSimulatedMetrics(65); // 65ms lag (Yellow)

    // LOW (Avatar/Analytics/Sync): Shed
    const {
      req: lowReq,
      res: lowRes,
      next: lowNext,
      resStatus,
      resSetHeader,
      resJson,
    } = createMockReqRes('/api/v1/analytics/export');

    middleware.use(lowReq, lowRes, lowNext);

    expect(lowNext).not.toHaveBeenCalled();
    expect(resStatus).toHaveBeenCalledWith(503);
    expect(resSetHeader).toHaveBeenCalledWith('Retry-After', 30);
    expect(resJson).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
        priorityTier: TrafficPriorityTier.LOW,
      }),
    );

    // NORMAL (Profile/Dashboard): Still admitted
    const {
      req: normalReq,
      res: normalRes,
      next: normalNext,
    } = createMockReqRes('/api/v1/profile/pratik');

    middleware.use(normalReq, normalRes, normalNext);
    expect(normalNext).toHaveBeenCalled();
  });

  it('should escalate and shed NORMAL & LOW priority requests when lag >= 100ms, while preserving CRITICAL & HIGH', () => {
    metricsService.setSimulatedMetrics(120); // 120ms lag (Red)

    // NORMAL: Shed
    const {
      req: normReq,
      res: normRes,
      next: normNext,
      resStatus: normStatus,
    } = createMockReqRes('/api/v1/leaderboard');
    middleware.use(normReq, normRes, normNext);
    expect(normNext).not.toHaveBeenCalled();
    expect(normStatus).toHaveBeenCalledWith(503);

    // LOW: Shed
    const {
      req: lowReq,
      res: lowRes,
      next: lowNext,
      resStatus: lowStatus,
    } = createMockReqRes('/api/v1/sync/owner');
    middleware.use(lowReq, lowRes, lowNext);
    expect(lowNext).not.toHaveBeenCalled();
    expect(lowStatus).toHaveBeenCalledWith(503);

    // HIGH (Auth/Matchmaking): Admitted
    const {
      req: highReq,
      res: highRes,
      next: highNext,
    } = createMockReqRes('/api/v1/auth/login');
    middleware.use(highReq, highRes, highNext);
    expect(highNext).toHaveBeenCalled();

    // CRITICAL (Battle Keystroke / WebSocket): NEVER shed under any circumstance
    const {
      req: critReq,
      res: critRes,
      next: critNext,
    } = createMockReqRes('/api/v1/battles/submit');
    middleware.use(critReq, critRes, critNext);
    expect(critNext).toHaveBeenCalled();

    const stats = middleware.getStats();
    expect(stats.currentSystemHealth).toBe('RED');
    expect(stats.shedByTier[TrafficPriorityTier.NORMAL]).toBe(1);
    expect(stats.shedByTier[TrafficPriorityTier.LOW]).toBe(1);
    expect(stats.shedByTier[TrafficPriorityTier.CRITICAL]).toBe(0);
    expect(stats.shedByTier[TrafficPriorityTier.HIGH]).toBe(0);
  });

  it('should enforce Little Law adaptive concurrency limits under load surges', () => {
    // Set low concurrency limit to simulate Little's Law saturation
    middleware.setConcurrencyForTest(2, 2);

    const { req, res, next, resStatus } = createMockReqRes('/api/v1/profile/view');
    middleware.use(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(resStatus).toHaveBeenCalledWith(503);

    // Critical requests still bypass concurrency caps
    const { req: cReq, res: cRes, next: cNext } = createMockReqRes('/api/v1/battles/action');
    middleware.use(cReq, cRes, cNext);
    expect(cNext).toHaveBeenCalled();
  });

  it('should simulate graduated recovery as system metrics return to green', () => {
    // 1. High Spike: 150ms (Red)
    metricsService.setSimulatedMetrics(150);
    const {
      req: spikeReq,
      res: spikeRes,
      next: spikeNext,
    } = createMockReqRes('/api/v1/profile/pratik');
    middleware.use(spikeReq, spikeRes, spikeNext);
    expect(spikeNext).not.toHaveBeenCalled();

    // 2. Recovery: 20ms (Green)
    metricsService.setSimulatedMetrics(20);
    const {
      req: recReq,
      res: recRes,
      next: recNext,
    } = createMockReqRes('/api/v1/profile/pratik');
    middleware.use(recReq, recRes, recNext);
    expect(recNext).toHaveBeenCalled();

    const stats = middleware.getStats();
    expect(stats.currentSystemHealth).toBe('GREEN');
  });
});
