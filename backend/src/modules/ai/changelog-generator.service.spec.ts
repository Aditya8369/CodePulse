import { Test, TestingModule } from '@nestjs/testing';
import { ChangelogGeneratorService } from './changelog-generator.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  GenerateChangelogRequestDto,
  PullRequestInputDto,
} from './dto/changelog.dto';

describe('ChangelogGeneratorService & Release Notes Suite (#364)', () => {
  let service: ChangelogGeneratorService;
  let mockPrisma: any;
  let mockConfig: any;

  beforeEach(async () => {
    mockPrisma = {
      releaseChangelog: {
        create: jest.fn().mockResolvedValue({ id: 'mock-cl-id' }),
      },
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'GITHUB_TOKEN') return 'ghp_mock_token_for_tests';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangelogGeneratorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<ChangelogGeneratorService>(ChangelogGeneratorService);
  });

  describe('Tag Range & SemVer Derivation', () => {
    it('accurately parses explicit tag comparison ranges (v1.0.0...v1.1.0)', () => {
      const result = service.resolveTagRange({
        repository: 'code-with-abhi-i5/CodePulse',
        tagRange: 'v1.0.0...v1.2.0',
      });

      expect(result.tagRange).toBe('v1.0.0...v1.2.0');
      expect(result.previousVersion).toBe('v1.0.0');
      expect(result.targetVersion).toBe('v1.2.0');
    });

    it('derives previous version when only targetVersion is provided', () => {
      const result = service.resolveTagRange({
        repository: 'code-with-abhi-i5/CodePulse',
        targetVersion: 'v2.1.0',
      });

      expect(result.targetVersion).toBe('v2.1.0');
      expect(result.previousVersion).toBe('v2.0.0');
      expect(result.tagRange).toBe('v2.0.0...v2.1.0');
    });
  });

  describe('SemVer Categorization of Pull Requests', () => {
    const mockPRs: PullRequestInputDto[] = [
      {
        number: 101,
        title: 'feat(battles): implement private battle lobbies with room passcodes',
        description: 'Enables private room creation with spectator seats.',
        author: { login: 'alice', avatarUrl: 'https://github.com/alice.png' },
        additions: 320,
        deletions: 40,
        filesChanged: 6,
      },
      {
        number: 102,
        title: 'fix(redis): resolve connection pool timeout under sudden spike load',
        description: 'Optimizes ioredis retry backoff and handles connection drops.',
        author: { login: 'bob', avatarUrl: 'https://github.com/bob.png' },
        additions: 45,
        deletions: 12,
        filesChanged: 2,
      },
      {
        number: 103,
        title: 'perf(queries): optimize user battle analytics query caching with xxhash',
        description: 'Reduces p99 latency from 140ms to 8ms by caching intermediate leaderboards.',
        author: { login: 'carol', avatarUrl: 'https://github.com/carol.png' },
        additions: 110,
        deletions: 35,
        filesChanged: 4,
      },
      {
        number: 104,
        title: 'docs(openapi): update OpenAPI 3.1 documentation for developer API keys',
        description: 'Adds Swagger request/response schemas for key generation endpoints.',
        author: { login: 'dave', avatarUrl: 'https://github.com/dave.png' },
        additions: 80,
        deletions: 5,
        filesChanged: 3,
      },
      {
        number: 105,
        title: 'refactor(core): decouple websocket gateway listeners into dedicated event dispatcher',
        description: 'Improves maintainability and modular testing.',
        author: { login: 'alice', avatarUrl: 'https://github.com/alice.png' },
        additions: 95,
        deletions: 70,
        filesChanged: 5,
      },
    ];

    it('correctly categorizes each PR into Features, Fixes, Perf, Docs, and Refactoring', () => {
      const { categories } = service.categorizePullRequests(mockPRs, 'code-with-abhi-i5/CodePulse');

      expect(categories.features).toHaveLength(1);
      expect(categories.features[0].number).toBe(101);

      expect(categories.bugFixes).toHaveLength(1);
      expect(categories.bugFixes[0].number).toBe(102);

      expect(categories.performance).toHaveLength(1);
      expect(categories.performance[0].number).toBe(103);

      expect(categories.documentation).toHaveLength(1);
      expect(categories.documentation[0].number).toBe(104);

      expect(categories.refactoring).toHaveLength(1);
      expect(categories.refactoring[0].number).toBe(105);
    });

    it('handles natural language titles without explicit conventional commit prefixes', () => {
      const nlPrs: PullRequestInputDto[] = [
        {
          number: 201,
          title: 'Add support for Python 3.12 syntax transpilation',
          author: { login: 'eve' },
        },
        {
          number: 202,
          title: 'Prevent crash when user token expires during active battle match',
          author: { login: 'frank' },
        },
        {
          number: 203,
          title: 'Speed up AST parsing pipeline by caching compiled syntax trees',
          author: { login: 'grace' },
        },
      ];

      const { categories } = service.categorizePullRequests(nlPrs, 'code-with-abhi-i5/CodePulse');

      expect(categories.features.some((p) => p.number === 201)).toBe(true);
      expect(categories.bugFixes.some((p) => p.number === 202)).toBe(true);
      expect(categories.performance.some((p) => p.number === 203)).toBe(true);
    });
  });

  describe('Breaking Changes & Migration Advice Extraction', () => {
    it('flags breaking changes indicated by exclamation mark (feat!:) and extracts migration advice', () => {
      const pr: PullRequestInputDto = {
        number: 301,
        title: 'feat(auth)!: migrate authentication to strict RSA-256 JWT signatures',
        description: `This update revokes legacy HMAC secret key verification in favor of RSA public key pairs.
        
## Migration Guide
Clients must update their environment configuration to supply the RSA public key before upgrading to v2.0.0. Requests using HMAC signatures will be rejected with 401 Unauthorized.`,
        author: { login: 'security-lead' },
        additions: 150,
        deletions: 80,
      };

      const result = service.classifyPullRequest(pr);

      expect(result.isBreaking).toBe(true);
      expect(result.breakingDetails).toBeDefined();
      expect(result.breakingDetails?.prNumber).toBe(301);
      expect(result.breakingDetails?.migrationAdvice).toContain(
        'Clients must update their environment configuration to supply the RSA public key',
      );
    });

    it('extracts breaking change details from BREAKING CHANGE: body section', () => {
      const pr: PullRequestInputDto = {
        number: 302,
        title: 'refactor(api): restructure battle session payload schema',
        description: `Refactors internal battle session initialization.
        
BREAKING CHANGE: The 'userId' parameter in POST /api/v1/battles/create has been renamed to 'creatorId'.`,
        author: { login: 'api-architect' },
      };

      const result = service.classifyPullRequest(pr);

      expect(result.isBreaking).toBe(true);
      expect(result.breakingDetails).toBeDefined();
      expect(result.breakingDetails?.migrationAdvice).toContain('creatorId');
    });
  });

  describe('Contributor Attribution & Deduplication', () => {
    it('aggregates all unique contributors with GitHub avatar metadata and PR counts', () => {
      const prs: PullRequestInputDto[] = [
        { number: 401, title: 'feat: a', author: { login: 'alice' } },
        { number: 402, title: 'fix: b', author: { login: 'bob' } },
        { number: 403, title: 'perf: c', author: { login: 'alice' } },
      ];

      const contributors = service.extractContributors(prs);

      expect(contributors).toHaveLength(2);
      // Alice contributed 2 PRs, Bob contributed 1 PR
      expect(contributors[0].login).toBe('alice');
      expect(contributors[0].prCount).toBe(2);
      expect(contributors[0].htmlUrl).toBe('https://github.com/alice');
      expect(contributors[0].avatarUrl).toContain('alice.png');

      expect(contributors[1].login).toBe('bob');
      expect(contributors[1].prCount).toBe(1);
    });
  });

  describe('Diff Statistics Calculation', () => {
    it('computes total PRs, files modified, additions, deletions, and active contributor counts', () => {
      const prs: PullRequestInputDto[] = [
        {
          number: 501,
          title: 'feat: x',
          author: { login: 'contributor1' },
          filesChanged: 4,
          additions: 120,
          deletions: 30,
        },
        {
          number: 502,
          title: 'fix: y',
          author: { login: 'contributor2' },
          filesChanged: 2,
          additions: 40,
          deletions: 10,
        },
      ];

      const stats = service.computeStats(prs, 2);

      expect(stats.totalPRs).toBe(2);
      expect(stats.filesChanged).toBe(6);
      expect(stats.additions).toBe(160);
      expect(stats.deletions).toBe(40);
      expect(stats.totalContributors).toBe(2);
    });
  });

  describe('Markdown Release Document Formatting', () => {
    it('formats clean, well-structured GitHub Release markdown with proper links and callouts', async () => {
      const request: GenerateChangelogRequestDto = {
        repository: 'code-with-abhi-i5/CodePulse',
        targetVersion: 'v1.5.0',
        previousVersion: 'v1.4.0',
        tagRange: 'v1.4.0...v1.5.0',
        releaseTitle: 'CodePulse 1.5.0: Enhanced Battle Reliability',
        pullRequests: [
          {
            number: 601,
            title: 'feat(battles)!: add persistent match recording and renames roomId to lobbyId',
            description: `Adds game recording replay engine.
            
## Migration Guide
Update all frontend WebSocket connection parameters from 'roomId' to 'lobbyId'.`,
            author: { login: 'alice', avatarUrl: 'https://github.com/alice.png' },
            additions: 450,
            deletions: 80,
            filesChanged: 10,
          },
          {
            number: 602,
            title: 'fix(ws): prevent heartbeat drop during reconnection',
            description: 'Fixes ping interval.',
            author: { login: 'bob', avatarUrl: 'https://github.com/bob.png' },
            additions: 25,
            deletions: 5,
            filesChanged: 1,
          },
        ],
      };

      const result = await service.generateChangelog(request);

      expect(result.targetVersion).toBe('v1.5.0');
      expect(result.tagRange).toBe('v1.4.0...v1.5.0');
      expect(result.breakingChanges).toHaveLength(1);
      expect(result.breakingChanges[0].prNumber).toBe(601);

      // Markdown verification
      const md = result.markdown;
      expect(md).toContain('# CodePulse 1.5.0: Enhanced Battle Reliability');
      expect(md).toContain('## What\'s Changed in v1.5.0');
      expect(md).toContain('### ⚠️ Breaking Changes');
      expect(md).toContain('> **Migration Advice**: Update all frontend WebSocket connection parameters');
      expect(md).toContain('### 🚀 Features');
      expect(md).toContain('### 🐛 Bug Fixes');
      expect(md).toContain('### 📊 Release Statistics');
      expect(md).toContain('### 👥 Contributors');
      expect(md).toContain('[@alice](https://github.com/alice)');
      expect(md).toContain('[@bob](https://github.com/bob)');
      expect(md).toContain('**Full Changelog**: https://github.com/code-with-abhi-i5/CodePulse/compare/v1.4.0...v1.5.0');
    });
  });

  describe('GitHub Webhook Automation', () => {
    it('successfully generates changelog from GitHub release webhook payload', async () => {
      const webhookPayload = {
        action: 'published',
        release: {
          id: 9991,
          tag_name: 'v2.0.0',
          name: 'CodePulse 2.0.0 Major Milestone',
          body: 'Pre-release notes',
          author: { login: 'maintainer' },
        },
        repository: {
          full_name: 'code-with-abhi-i5/CodePulse',
          name: 'CodePulse',
        },
      };

      const result = await service.generateChangelogFromWebhook(webhookPayload);

      expect(result).toBeDefined();
      expect(result.targetVersion).toBe('v2.0.0');
      expect(result.markdown).toContain('v2.0.0');
    });
  });
});
