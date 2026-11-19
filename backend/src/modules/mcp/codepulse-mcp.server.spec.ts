import { Test, TestingModule } from '@nestjs/testing';
import { CodepulseMcpServer } from './codepulse-mcp.server';
import { McpController } from './mcp.controller';
import { PrismaService } from '../../prisma/prisma.service';

describe('CodepulseMcpServer & McpController', () => {
  let server: CodepulseMcpServer;
  let controller: McpController;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      user: { findFirst: jest.fn() },
      repository: { findUnique: jest.fn() },
      challenge: { findMany: jest.fn() },
      battle: { findMany: jest.fn() },
      badge: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [McpController],
      providers: [
        CodepulseMcpServer,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    server = module.get<CodepulseMcpServer>(CodepulseMcpServer);
    controller = module.get<McpController>(McpController);
  });

  describe('Manifest & Protocol Discovery', () => {
    it('returns compliant MCP v1.0 manifest with tools and resources', () => {
      const manifest = controller.getManifest();
      expect(manifest.name).toBe('codepulse-mcp-server');
      expect(manifest.capabilities.tools).toBe(true);
      expect(manifest.capabilities.resources).toBe(true);
      expect(manifest.tools.length).toBe(5);
      expect(manifest.resources.length).toBe(3);
    });

    it('lists all 5 official MCP tools with JSON schemas', () => {
      const tools = controller.listTools().tools;
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('get_developer_profile');
      expect(toolNames).toContain('query_repository_metrics');
      expect(toolNames).toContain('list_active_challenges');
      expect(toolNames).toContain('submit_challenge_solution');
      expect(toolNames).toContain('run_code_benchmark');
    });

    it('lists all 3 official MCP resource URI templates', () => {
      const resources = controller.listResources().resources;
      const uris = resources.map((r) => r.uriTemplate);
      expect(uris).toContain('codepulse://repositories/{id}/analytics');
      expect(uris).toContain('codepulse://battles/recent');
      expect(uris).toContain('codepulse://badges/user');
    });
  });

  describe('API Key Authentication & Rate Limiting', () => {
    it('verifies valid cp_mcp_* API keys', () => {
      expect(server.verifyApiKey('cp_mcp_123456789012345678901234')).toBe(true);
      expect(server.verifyApiKey('invalid-key')).toBe(false);
      expect(server.verifyApiKey(undefined)).toBe(false);
    });

    it('blocks unauthorized tool execution if invalid API key is supplied', async () => {
      const res = await server.executeTool('get_developer_profile', { username: 'alice' }, 'bad-key');
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain('401 Unauthorized');
    });

    it('enforces rate limiting at 60 req/min', () => {
      const id = 'client-limit-test';
      for (let i = 0; i < 60; i++) {
        expect(server.checkRateLimit(id)).toBe(true);
      }
      expect(server.checkRateLimit(id)).toBe(false); // 61st request rejected
    });
  });

  describe('MCP Tools Execution', () => {
    it('executes get_developer_profile tool', async () => {
      const res = await server.executeTool('get_developer_profile', { username: 'octocat' });
      expect(res.isError).toBeFalsy();
      expect(res.content[0].type).toBe('json');
      const data = res.content[0].data as any;
      expect(data.username).toBe('octocat');
      expect(data.rating).toBeGreaterThan(0);
    });

    it('executes query_repository_metrics tool', async () => {
      const res = await server.executeTool('query_repository_metrics', { repositoryId: 'repo-1' });
      expect(res.isError).toBeFalsy();
      const data = res.content[0].data as any;
      expect(data.healthScore).toBeGreaterThan(0);
    });

    it('executes list_active_challenges tool', async () => {
      const res = await server.executeTool('list_active_challenges', { difficulty: 'HARD' });
      expect(res.isError).toBeFalsy();
      const data = res.content[0].data as any[];
      expect(Array.isArray(data)).toBe(true);
    });

    it('executes submit_challenge_solution tool and returns grading feedback', async () => {
      const res = await server.executeTool('submit_challenge_solution', {
        challengeId: 'c1',
        language: 'typescript',
        code: 'export function solution() { return true; }',
      });
      expect(res.isError).toBeFalsy();
      const data = res.content[0].data as any;
      expect(data.status).toBe('ACCEPTED');
      expect(data.testsPassed).toBe(15);
    });

    it('executes run_code_benchmark tool', async () => {
      const res = await server.executeTool('run_code_benchmark', {
        language: 'typescript',
        code: 'const a = [1, 2, 3].sort();',
        iterations: 50,
      });
      expect(res.isError).toBeFalsy();
      const data = res.content[0].data as any;
      expect(data.complexityEstimate).toBeDefined();
      expect(data.meanExecutionTimeMs).toBeLessThan(1);
    });

    it('returns error for unknown tool', async () => {
      const res = await server.executeTool('non_existent_tool', {});
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain('Unknown MCP tool');
    });
  });

  describe('MCP Resources Resolution', () => {
    it('reads codepulse://repositories/{id}/analytics', async () => {
      const res = await server.readResource('codepulse://repositories/repo-42/analytics');
      expect(res.mimeType).toBe('application/json');
      expect((res.contents as any).healthScore).toBeGreaterThan(0);
    });

    it('reads codepulse://battles/recent', async () => {
      const res = await server.readResource('codepulse://battles/recent');
      expect(res.mimeType).toBe('application/json');
      expect(Array.isArray(res.contents)).toBe(true);
    });

    it('reads codepulse://badges/user', async () => {
      const res = await server.readResource('codepulse://badges/user');
      expect(res.mimeType).toBe('application/json');
      expect(Array.isArray(res.contents)).toBe(true);
    });

    it('throws NotFoundException for unrecognized resource URI', async () => {
      await expect(server.readResource('codepulse://unknown/uri')).rejects.toThrow();
    });
  });
});
