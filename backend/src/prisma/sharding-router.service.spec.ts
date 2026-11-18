import { Test, TestingModule } from '@nestjs/testing';
import {
  ShardingRouterService,
  ShardNodeConfig,
  IShardClientAdapter,
} from './sharding-router.service';
import { PrismaClient } from '@prisma/client';

describe('ShardingRouterService', () => {
  let service: ShardingRouterService;
  const mockClients: Map<string, any> = new Map();

  const customAdapter: IShardClientAdapter = {
    createClient: (shardId: string, url: string) => {
      const mock = {
        shardId,
        url,
        user: {
          findMany: jest.fn().mockImplementation((args) => {
            return Promise.resolve([
              { id: `${shardId}-user-1`, score: 100 },
              { id: `${shardId}-user-2`, score: 80 },
            ]);
          }),
        },
        $connect: jest.fn().mockResolvedValue(undefined),
        $disconnect: jest.fn().mockResolvedValue(undefined),
      } as unknown as PrismaClient;
      mockClients.set(shardId, mock);
      return mock;
    },
    destroyClient: async (client: any) => {
      await client.$disconnect();
    },
  };

  const testShards: ShardNodeConfig[] = [
    {
      shardId: 'shard-global',
      name: 'Global-Shared',
      databaseUrl: 'postgresql://localhost:5432/global',
      isGlobal: true,
    },
    {
      shardId: 'shard-alpha',
      name: 'Tenant-Cluster-Alpha',
      databaseUrl: 'postgresql://localhost:5433/shard_alpha',
      weight: 100,
    },
    {
      shardId: 'shard-beta',
      name: 'Tenant-Cluster-Beta',
      databaseUrl: 'postgresql://localhost:5434/shard_beta',
      weight: 100,
    },
    {
      shardId: 'shard-gamma',
      name: 'Tenant-Cluster-Gamma',
      databaseUrl: 'postgresql://localhost:5435/shard_gamma',
      weight: 100,
    },
  ];

  beforeEach(() => {
    mockClients.clear();
    service = new ShardingRouterService(testShards, customAdapter);
    service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('Consistent Hashing & Tenant Shard Resolution', () => {
    it('routes global and system operations to shard-global', () => {
      expect(service.resolveShardId(null)).toBe('shard-global');
      expect(service.resolveShardId('global')).toBe('shard-global');
      expect(service.resolveShardId('system')).toBe('shard-global');
    });

    it('deterministically maps organization/guild IDs to tenant shards', () => {
      const orgA = 'org-harvard-university-001';
      const orgB = 'org-mit-coding-club-002';

      const shard1 = service.resolveShardId(orgA);
      const shard2 = service.resolveShardId(orgA); // Must be strictly deterministic

      expect(shard1).toBe(shard2);
      expect(['shard-alpha', 'shard-beta', 'shard-gamma']).toContain(shard1);

      const shardB = service.resolveShardId(orgB);
      expect(['shard-alpha', 'shard-beta', 'shard-gamma']).toContain(shardB);
    });

    it('distributes 100 distinct tenant IDs evenly across the consistent hashing ring without hot-spotting', () => {
      const distribution: Record<string, number> = {
        'shard-alpha': 0,
        'shard-beta': 0,
        'shard-gamma': 0,
      };

      for (let i = 0; i < 150; i++) {
        const tenantId = `tenant-bootcamp-cohort-${i}`;
        const targetShard = service.resolveShardId(tenantId);
        distribution[targetShard]++;
      }

      // Every tenant shard should receive an equitable share of the tenant keyspace
      expect(distribution['shard-alpha']).toBeGreaterThan(20);
      expect(distribution['shard-beta']).toBeGreaterThan(20);
      expect(distribution['shard-gamma']).toBeGreaterThan(20);
    });

    it('returns the dedicated PrismaClient for a resolved tenant shard', () => {
      const client = service.getShardClient('org-stanford-ai');
      expect(client).toBeDefined();
      expect((client as any).shardId).toMatch(/shard-(alpha|beta|gamma)/);
    });
  });

  describe('Scatter-Gather Query Execution Across Shards', () => {
    it('fans out queries in parallel across all database clusters and aggregates sorted results', async () => {
      const results = await service.scatterGather(
        async (client, shardId) => {
          return [
            { orgId: `${shardId}-org`, score: shardId === 'shard-alpha' ? 500 : 300 },
          ];
        },
        (a, b) => b.score - a.score, // Sort descending by score
        2, // Top 2
      );

      expect(results.length).toBe(2);
      expect(results[0].score).toBe(500);
      expect(results[1].score).toBe(300);
    });
  });

  describe('Zero-Downtime Shard Rebalancing / Tenant Migration', () => {
    it('migrates a tenant to a dedicated high-capacity shard without downtime', async () => {
      const tenantId = 'enterprise-netflix-engineering';
      const initialShard = service.resolveShardId(tenantId);

      const targetShard =
        initialShard === 'shard-alpha' ? 'shard-beta' : 'shard-alpha';

      const migrationResult = await service.rebalanceTenantShard(
        tenantId,
        targetShard,
      );

      expect(migrationResult.status).toBe('COMPLETED');
      expect(migrationResult.toShardId).toBe(targetShard);
      expect(service.resolveShardId(tenantId)).toBe(targetShard);

      const entry = service.getDirectoryEntry(tenantId);
      expect(entry?.shardId).toBe(targetShard);
      expect(entry?.migrationStatus).toBe('COMPLETED');
    });
  });

  describe('Cluster Status & Reporting', () => {
    it('returns a comprehensive cluster report of shards and tenant load', () => {
      service.resolveShardId('tenant-1');
      service.resolveShardId('tenant-2');

      const report = service.getClusterReport();

      expect(report.totalShards).toBe(4);
      expect(report.globalShardId).toBe('shard-global');
      expect(report.registeredTenantsCount).toBe(2);
      expect(report.shards.length).toBe(4);
    });
  });
});

