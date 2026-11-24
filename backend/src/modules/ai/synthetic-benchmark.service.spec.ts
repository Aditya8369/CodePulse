import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SyntheticBenchmarkService } from './synthetic-benchmark.service';
import { BenchmarkScenarioType } from './dto/benchmark-request.dto';

describe('SyntheticBenchmarkService (#527)', () => {
  let service: SyntheticBenchmarkService;

  const sampleOpenApiSpec = {
    openapi: '3.0.0',
    info: { title: 'CodePulse Test API', version: '1.0.0' },
    paths: {
      '/api/v1/battles': {
        post: {
          summary: 'Create a battle match',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    language: { type: 'string' },
                    maxParticipants: { type: 'integer', minimum: 2, maximum: 10 },
                    creatorId: { type: 'string', format: 'uuid' },
                    isRanked: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
        get: {
          summary: 'List active battles',
        },
      },
      '/api/v1/users/{id}': {
        get: {
          summary: 'Get user profile by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        },
      },
    },
  };

  beforeEach(() => {
    service = new SyntheticBenchmarkService();
  });

  describe('1. OpenAPI Specification Parsing & Endpoint Coverage', () => {
    it('generates valid k6 load script covering 100% of specified endpoints', async () => {
      const response = await service.generateBenchmark({
        openApiSpec: sampleOpenApiSpec,
        vus: 40,
        durationSeconds: 30,
        rampUpSeconds: 10,
        baseUrl: 'https://api.codepulse.dev',
      });

      expect(response.benchmarkId).toMatch(/^bm-[a-f0-9]{8}$/);
      expect(response.endpointsCovered).toEqual([
        'GET /api/v1/battles',
        'POST /api/v1/battles',
        'GET /api/v1/users/{id}',
      ]);

      // Script imports k6 modules
      expect(response.k6Script).toContain("import http from 'k6/http';");
      expect(response.k6Script).toContain("import { check, sleep } from 'k6';");

      // Covers all HTTP methods in generated functions
      expect(response.k6Script).toContain('http.post(');
      expect(response.k6Script).toContain('http.get(');
      expect(response.k6Script).toContain('https://api.codepulse.dev/api/v1/battles');
    });

    it('filters endpoints when targetEndpoints list is supplied', async () => {
      const response = await service.generateBenchmark({
        openApiSpec: sampleOpenApiSpec,
        targetEndpoints: ['/api/v1/battles'],
      });

      expect(response.endpointsCovered).toEqual(['GET /api/v1/battles', 'POST /api/v1/battles']);
      expect(response.k6Script).not.toContain('/api/v1/users');
    });

    it('throws BadRequestException for malformed OpenAPI JSON string', async () => {
      await expect(
        service.generateBenchmark({
          openApiSpec: '{ invalid json here...',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Schema-Valid Dummy Payload Synthesis', () => {
    it('generates realistic dummy payloads respecting constraints and foreign keys', async () => {
      const response = await service.generateBenchmark({
        openApiSpec: sampleOpenApiSpec,
      });

      const payload = response.syntheticPayloadExamples['POST /api/v1/battles'];
      expect(payload).toBeDefined();

      // Check string semantics
      expect(typeof payload.title).toBe('string');
      expect(payload.language).toBe('typescript');

      // Check integer constraints: minimum 2, maximum 10
      expect(payload.maxParticipants).toBeGreaterThanOrEqual(2);
      expect(payload.maxParticipants).toBeLessThanOrEqual(10);

      // Check foreign key UUID format
      expect(payload.creatorId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );

      // Check boolean
      expect(payload.isRanked).toBe(true);
    });
  });

  describe('3. Configurable Virtual Users (VUs) & Stage Scenarios', () => {
    it('configures custom VUs, ramp-up, steady-state, and spike stages', async () => {
      const response = await service.generateBenchmark({
        openApiSpec: sampleOpenApiSpec,
        vus: 80,
        rampUpSeconds: 20,
        durationSeconds: 120,
        spikeVus: 250,
        scenarioType: BenchmarkScenarioType.RAMP_AND_SPIKE,
      });

      expect(response.stages).toEqual([
        { duration: '20s', target: 80 },
        { duration: '120s', target: 80 },
        { duration: '10s', target: 250 },
        { duration: '20s', target: 250 },
        { duration: '20s', target: 0 },
      ]);

      expect(response.k6Script).toContain('"target": 80');
      expect(response.k6Script).toContain('"target": 250');
    });

    it('configures threshold assertions for P95 latency and error rates', async () => {
      const response = await service.generateBenchmark({
        openApiSpec: sampleOpenApiSpec,
        thresholds: {
          p95LatencyMs: 150,
          maxErrorRate: 0.005,
        },
      });

      expect(response.k6Script).toContain("http_req_duration: ['p(95)<150']");
      expect(response.k6Script).toContain("http_req_failed: ['rate<0.005']");
    });
  });

  describe('4. Template Injection Safety & Sanitization', () => {
    it('rejects malicious endpoint paths containing shell or script injection payloads', async () => {
      const maliciousSpec = {
        openapi: '3.0.0',
        paths: {
          '/api/v1/hack; rm -rf /;': {
            get: { summary: 'Exploit' },
          },
        },
      };

      await expect(
        service.generateBenchmark({
          openApiSpec: maliciousSpec,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates k6 script syntax and blocks forbidden dangerous tokens', () => {
      expect(() => {
        service.validateK6ScriptSyntax('import http from "k6/http"; export default function() {}');
      }).not.toThrow();

      expect(() => {
        service.validateK6ScriptSyntax('require("child_process").exec("whoami")');
      }).toThrow(BadRequestException);
    });
  });

  describe('5. Execution Trigger & Throughput Timeline', () => {
    it('simulates sandboxed benchmark execution and returns throughput timeline', async () => {
      const generated = await service.generateBenchmark({
        openApiSpec: sampleOpenApiSpec,
        vus: 50,
      });

      const execution = await service.executeBenchmark({
        benchmarkId: generated.benchmarkId,
        dryRun: true,
      });

      expect(execution.status).toBe('COMPLETED');
      expect(execution.totalRequests).toBeGreaterThan(100);
      expect(execution.p95LatencyMs).toBeGreaterThan(0);
      expect(execution.p99LatencyMs).toBeGreaterThanOrEqual(execution.p95LatencyMs);
      expect(execution.throughputTimeline.length).toBeGreaterThan(10);
      expect(execution.passedThresholds).toBe(true);

      const firstPoint = execution.throughputTimeline[0];
      expect(firstPoint.second).toBe(1);
      expect(firstPoint.rps).toBeGreaterThan(0);
      expect(firstPoint.p95Ms).toBeGreaterThan(0);
    });

    it('retrieves saved benchmark from registry', async () => {
      const generated = await service.generateBenchmark({
        openApiSpec: sampleOpenApiSpec,
      });

      const retrieved = service.getBenchmark(generated.benchmarkId);
      expect(retrieved.benchmarkId).toBe(generated.benchmarkId);
      expect(retrieved.k6Script).toBe(generated.k6Script);
    });

    it('throws NotFoundException for unknown benchmark ID', () => {
      expect(() => service.getBenchmark('bm-non-existent')).toThrow(NotFoundException);
    });
  });
});

