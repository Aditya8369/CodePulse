import { HsmService } from './hsm.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('HsmService (Hierarchical Storage Management #458)', () => {
  let service: HsmService;
  let tempStorageRoot: string;
  let mockPrisma: any;

  beforeEach(() => {
    tempStorageRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'codepulse-hsm-test-'),
    );
    mockPrisma = {
      commitArchive: {
        upsert: jest.fn(async ({ create }: any) => ({
          id: 'archive-uuid-1',
          ...create,
        })),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(async ({ data }: any) => ({
          id: 'archive-uuid-1',
          ...data,
        })),
      },
    };

    service = new HsmService(
      mockPrisma as unknown as PrismaService,
      tempStorageRoot,
    );
  });

  afterEach(() => {
    try {
      fs.rmSync(tempStorageRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('Hot SSD Commit Archiving', () => {
    it('archives new commit onto Hot SSD tier with 1.0 compression ratio', async () => {
      const diff = 'diff --git a/src/index.ts b/src/index.ts\n+console.log("hello");';
      const result = await service.archiveCommit({
        repositoryId: 'repo-100',
        commitSha: 'a1b2c3d4',
        diffContent: diff,
      });

      expect(result.tier).toBe('HOT');
      expect(result.originalBytes).toBe(Buffer.byteLength(diff));
      expect(result.compressedBytes).toBe(Buffer.byteLength(diff));
      expect(result.compressionRatio).toBe(1.0);
      expect(mockPrisma.commitArchive.upsert).toHaveBeenCalled();
    });
  });

  describe('Automated Lifecycle Tiering Migration', () => {
    it('migrates commits 30-365 days old to Warm S3 (Gzip compressed)', async () => {
      const diff = 'import React from "react";\nexport const Button = () => <button>Click</button>;';
      const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000); // 45 days old

      const archived = await service.archiveCommit({
        repositoryId: 'repo-100',
        commitSha: 'warm-sha-1',
        diffContent: diff,
        createdAt: oldDate,
      });

      mockPrisma.commitArchive.findMany.mockResolvedValueOnce([
        {
          id: 'archive-uuid-1',
          repositoryId: 'repo-100',
          commitSha: 'warm-sha-1',
          tier: 'HOT',
          storageLocation: path.join(tempStorageRoot, 'hot', 'repo-100_warm-sha-1.diff'),
          originalBytes: Buffer.byteLength(diff),
          archivedAt: oldDate,
        },
      ]);

      const migration = await service.runLifecycleTieringMigration();

      expect(migration.migratedToWarm).toBe(1);
      expect(migration.migratedToCold).toBe(0);
      expect(mockPrisma.commitArchive.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tier: 'WARM',
          }),
        }),
      );
    });

    it('migrates commits > 365 days old to Cold Glacier (Brotli max-compression)', async () => {
      const diff = 'const ancientCode = "written 2 years ago in 2024";'.repeat(20);
      const ancientDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000); // 400 days old

      await service.archiveCommit({
        repositoryId: 'repo-ancient',
        commitSha: 'ancient-sha-1',
        diffContent: diff,
        createdAt: ancientDate,
      });

      mockPrisma.commitArchive.findMany.mockResolvedValueOnce([
        {
          id: 'archive-ancient-1',
          repositoryId: 'repo-ancient',
          commitSha: 'ancient-sha-1',
          tier: 'HOT',
          storageLocation: path.join(tempStorageRoot, 'hot', 'repo-ancient_ancient-sha-1.diff'),
          originalBytes: Buffer.byteLength(diff),
          archivedAt: ancientDate,
        },
      ]);

      const migration = await service.runLifecycleTieringMigration();

      expect(migration.migratedToCold).toBe(1);
      expect(migration.totalBytesSaved).toBeGreaterThan(0);
      expect(mockPrisma.commitArchive.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tier: 'COLD',
          }),
        }),
      );
    });
  });

  describe('Transparent Retrieval Gateway', () => {
    it('transparently fetches and decompresses diff from Warm S3 tier', async () => {
      const originalDiff = 'const feature = "warm tier diff content";';
      const commit = await service.archiveCommit({
        repositoryId: 'repo-retrieve',
        commitSha: 'sha-retrieve-warm',
        diffContent: originalDiff,
      });

      // Migrate to warm
      await service.migrateToWarm({
        id: 'archive-retrieve-1',
        repositoryId: 'repo-retrieve',
        commitSha: 'sha-retrieve-warm',
        storageLocation: path.join(tempStorageRoot, 'hot', 'repo-retrieve_sha-retrieve-warm.diff'),
        originalBytes: Buffer.byteLength(originalDiff),
      });

      mockPrisma.commitArchive.findUnique.mockResolvedValueOnce({
        id: 'archive-retrieve-1',
        repositoryId: 'repo-retrieve',
        commitSha: 'sha-retrieve-warm',
        tier: 'WARM',
        storageLocation: path.join(tempStorageRoot, 'warm', 'repo-retrieve_sha-retrieve-warm.diff.gz'),
        originalBytes: Buffer.byteLength(originalDiff),
        compressedBytes: 20,
        compressionRatio: 0.5,
        accessCount: 2,
        lastAccessedAt: new Date(),
      });

      const retrieved = await service.getCommitDiff('repo-retrieve', 'sha-retrieve-warm');

      expect(retrieved.diffContent).toBe(originalDiff);
      expect(retrieved.tier).toBe('WARM');
      expect(retrieved.accessCount).toBe(3);
    });

    it('transparently fetches and decompresses diff from Cold Glacier tier', async () => {
      const originalDiff = 'const archive = "cold glacier brotli content";';
      await service.archiveCommit({
        repositoryId: 'repo-retrieve',
        commitSha: 'sha-retrieve-cold',
        diffContent: originalDiff,
      });

      // Migrate to cold
      await service.migrateToCold({
        id: 'archive-cold-1',
        repositoryId: 'repo-retrieve',
        commitSha: 'sha-retrieve-cold',
        storageLocation: path.join(tempStorageRoot, 'hot', 'repo-retrieve_sha-retrieve-cold.diff'),
        originalBytes: Buffer.byteLength(originalDiff),
      });

      mockPrisma.commitArchive.findUnique.mockResolvedValueOnce({
        id: 'archive-cold-1',
        repositoryId: 'repo-retrieve',
        commitSha: 'sha-retrieve-cold',
        tier: 'COLD',
        storageLocation: path.join(tempStorageRoot, 'cold', 'repo-retrieve_sha-retrieve-cold.diff.br'),
        originalBytes: Buffer.byteLength(originalDiff),
        compressedBytes: 15,
        compressionRatio: 0.3,
        accessCount: 0,
        lastAccessedAt: new Date(),
      });

      const retrieved = await service.getCommitDiff('repo-retrieve', 'sha-retrieve-cold');

      expect(retrieved.diffContent).toBe(originalDiff);
      expect(retrieved.tier).toBe('COLD');
    });

    it('throws NotFoundException when commit archive does not exist', async () => {
      mockPrisma.commitArchive.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.getCommitDiff('repo-404', 'non-existent-sha'),
      ).rejects.toThrow('Commit archive non-existent-sha not found for repository repo-404');
    });
  });

  describe('Storage Tier Audit & Cost Savings Calculation', () => {
    it('calculates storage distribution and > 80% cost savings for repositories with cold commits', async () => {
      mockPrisma.commitArchive.findMany.mockResolvedValueOnce([
        // 5 hot commits
        ...Array.from({ length: 5 }, (_, i) => ({
          repositoryId: 'large-repo-50k',
          commitSha: `hot-${i}`,
          tier: 'HOT',
          originalBytes: 10000,
          compressedBytes: 10000,
        })),
        // 20 warm commits
        ...Array.from({ length: 20 }, (_, i) => ({
          repositoryId: 'large-repo-50k',
          commitSha: `warm-${i}`,
          tier: 'WARM',
          originalBytes: 10000,
          compressedBytes: 3000,
        })),
        // 75 cold commits
        ...Array.from({ length: 75 }, (_, i) => ({
          repositoryId: 'large-repo-50k',
          commitSha: `cold-${i}`,
          tier: 'COLD',
          originalBytes: 10000,
          compressedBytes: 1500,
        })),
      ]);

      const audit = await service.getStorageTierAudit();

      expect(audit.totalArchives).toBe(100);
      expect(audit.hotTierCount).toBe(5);
      expect(audit.warmTierCount).toBe(20);
      expect(audit.coldTierCount).toBe(75);
      expect(audit.totalBytesSaved).toBeGreaterThan(0);
      expect(audit.overallCompressionPercentage).toBeGreaterThan(70);
      expect(audit.estimatedSavingsPercentage).toBeGreaterThan(80);

      const repoSavings = audit.repositoryBreakdown['large-repo-50k'].costSavingsPercentage;
      expect(repoSavings).toBeGreaterThan(80); // Achieves > 80% cost savings
    });
  });
});

