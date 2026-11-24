#!/usr/bin/env ts-node
/**
 * Zero-Downtime Blue-Green Database Migration Pipeline CLI
 *
 * Implements the Expand & Contract pattern for Prisma & PostgreSQL.
 *
 * Usage:
 *   ts-node zero-downtime.ts --phase=expand --table=users --sql="..."
 *   ts-node zero-downtime.ts --phase=backfill --table=users --source=email --target=email_normalized
 *   ts-node zero-downtime.ts --phase=verify --table=users --source=email --target=email_normalized
 *   ts-node zero-downtime.ts --phase=contract --table=users --sql="..."
 *   ts-node zero-downtime.ts --phase=rollback --sql="..."
 *
 * Programmatic usage:
 *   import { ZeroDowntimeMigrationEngine, DualWriteCoordinator } from './zero-downtime';
 */

import { PrismaClient } from '@prisma/client';
import {
  ZeroDowntimeMigrationEngine,
  DualWriteCoordinator,
  MigrationPhase,
  PreflightLockCheckResult,
  ExpandPlan,
  BackfillOptions,
  BackfillProgress,
  VerificationResult,
  ContractPlan,
  DualWriteConfig,
} from '../../src/prisma/zero-downtime';

export {
  ZeroDowntimeMigrationEngine,
  DualWriteCoordinator,
  MigrationPhase,
  PreflightLockCheckResult,
  ExpandPlan,
  BackfillOptions,
  BackfillProgress,
  VerificationResult,
  ContractPlan,
  DualWriteConfig,
};

/**
 * Example migration plan blueprint: Users bio column migration to rich_bio JSONB
 */
export const SAMPLE_EXPAND_PLAN: ExpandPlan = {
  name: 'add_rich_bio_to_users',
  tableName: 'users',
  expandSql: [
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rich_bio" JSONB DEFAULT NULL;`,
  ],
  rollbackSql: [`ALTER TABLE "users" DROP COLUMN IF EXISTS "rich_bio";`],
  lockTimeoutMs: 2000,
};

export const SAMPLE_CONTRACT_PLAN: ContractPlan = {
  name: 'drop_legacy_bio_from_users',
  tableName: 'users',
  contractSql: [`ALTER TABLE "users" DROP COLUMN IF EXISTS "bio";`],
  rollbackSql: [`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" TEXT DEFAULT NULL;`],
  lockTimeoutMs: 2000,
};

/**
 * CLI Entrypoint
 */
export async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  const flags: Record<string, string> = {};

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      flags[key] = value ?? 'true';
    }
  }

  const phase = (flags.phase?.toUpperCase() || 'HELP') as MigrationPhase | 'HELP';
  const table = flags.table || 'users';
  const source = flags.source || '';
  const target = flags.target || '';
  const batchSize = Number(flags.batchSize || '1000');
  const sleepMs = Number(flags.sleepMs || '50');

  const prisma = new PrismaClient();
  const engine = new ZeroDowntimeMigrationEngine();

  console.log(`=======================================================`);
  console.log(`🛡️  CodePulse Zero-Downtime Blue-Green Migration CLI`);
  console.log(`=======================================================`);
  console.log(`Phase: ${phase} | Table: ${table}`);

  try {
    switch (phase) {
      case 'EXPAND': {
        console.log(`Checking pre-flight lock duration...`);
        const preflight = await engine.checkPreflightLocks(prisma, table);
        if (!preflight.safe) {
          console.error(`❌ Preflight failed: ${preflight.reason}`);
          process.exit(1);
        }
        console.log(`✅ Preflight check passed. Applying safe expand DDL...`);
        const plan: ExpandPlan = {
          name: flags.name || `expand_${table}`,
          tableName: table,
          expandSql: flags.sql ? [flags.sql] : SAMPLE_EXPAND_PLAN.expandSql,
          rollbackSql: flags.rollback ? [flags.rollback] : SAMPLE_EXPAND_PLAN.rollbackSql,
        };
        const result = await engine.executePhaseExpand(prisma, plan);
        console.log(`✅ Expand Phase completed successfully:`, result.applied);
        break;
      }

      case 'BACKFILL': {
        if (!source || !target) {
          console.error(`❌ Error: --source and --target columns are required for backfill.`);
          process.exit(1);
        }
        console.log(`Running batch backfill from "${source}" to "${target}"...`);
        const progress = await engine.runBackfill(
          prisma,
          {
            tableName: table,
            sourceColumn: source,
            targetColumn: target,
            batchSize,
            sleepMs,
          },
          (p: BackfillProgress) => {
            console.log(
              `  Progress: ${p.totalProcessed} rows backfilled (${p.batchesCompleted} batches, ${p.rateRowsPerSec} rows/sec)`,
            );
          },
        );
        console.log(`✅ Backfill Phase completed:`, progress);
        break;
      }

      case 'VERIFY': {
        if (!source || !target) {
          console.error(`❌ Error: --source and --target columns are required for verify.`);
          process.exit(1);
        }
        console.log(`Verifying consistency between "${source}" and "${target}" on "${table}"...`);
        const result = await engine.verifyDataConsistency(prisma, {
          tableName: table,
          sourceColumn: source,
          targetColumn: target,
        });
        if (result.consistent) {
          console.log(`✅ Data consistency verified! 100% match across ${result.totalRecordsChecked} records.`);
        } else {
          console.error(
            `❌ Consistency verification failed! Mismatches: ${result.mismatchCount}, Missing in target: ${result.missingInTargetCount}`,
          );
          console.error(`Discrepancies sample:`, result.discrepancies);
          process.exit(1);
        }
        break;
      }

      case 'CONTRACT': {
        console.log(`Checking pre-flight locks before Contract...`);
        const preflight = await engine.checkPreflightLocks(prisma, table);
        if (!preflight.safe) {
          console.error(`❌ Preflight failed: ${preflight.reason}`);
          process.exit(1);
        }
        console.log(`Applying safe contract DDL...`);
        const plan: ContractPlan = {
          name: flags.name || `contract_${table}`,
          tableName: table,
          contractSql: flags.sql ? [flags.sql] : SAMPLE_CONTRACT_PLAN.contractSql,
          rollbackSql: flags.rollback ? [flags.rollback] : SAMPLE_CONTRACT_PLAN.rollbackSql,
        };
        const result = await engine.executePhaseContract(prisma, plan);
        console.log(`✅ Contract Phase completed:`, result.applied);
        break;
      }

      case 'ROLLBACK': {
        if (!flags.sql) {
          console.error(`❌ Error: --sql is required for rollback.`);
          process.exit(1);
        }
        console.log(`Rolling back DDL with safe lock timeout...`);
        const result = await engine.executeRollback(prisma, [flags.sql]);
        console.log(`✅ Rollback completed:`, result.rolledBack);
        break;
      }

      default: {
        console.log(`Available phases:`);
        console.log(`  --phase=expand   --table=<table> --sql="<safe additive DDL>"`);
        console.log(`  --phase=backfill --table=<table> --source=<col> --target=<col> [--batchSize=1000] [--sleepMs=50]`);
        console.log(`  --phase=verify   --table=<table> --source=<col> --target=<col>`);
        console.log(`  --phase=contract --table=<table> --sql="<safe contract DDL>"`);
        console.log(`  --phase=rollback --sql="<rollback DDL>"`);
        break;
      }
    }
  } catch (err: any) {
    console.error(`❌ Migration pipeline failed:`, err?.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  runCli().catch((err) => {
    console.error(`Fatal error in zero-downtime CLI:`, err);
    process.exit(1);
  });
}

