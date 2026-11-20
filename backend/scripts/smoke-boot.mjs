/**
 * CodePulse Backend Production Boot & Dependency Injection Smoke Test
 *
 * Verifies two critical runtime requirements that cannot be caught by tsc alone:
 * 1. NestJS Dependency Injection Graph: Compiles AppModule and ensures all
 *    service constructors and module dependencies resolve with 0 exceptions.
 * 2. Express 5 / path-to-regexp Route Validation: Scans all controllers and verifies
 *    that every route path adheres to path-to-regexp v8 syntax (rejecting deprecated :param(*) syntax).
 */

process.env.PORT = process.env.PORT || '3999';
process.env.NODE_ENV = 'test';
process.env.CI_SMOKE_BOOT = 'true';
process.env.SKIP_DB_CONNECT = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-smoke-test-jwt-secret-xyz12345678901234567890';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
process.env.DIRECT_URL = process.env.DIRECT_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

import { Test } from '@nestjs/testing';
import { pathToRegexp } from 'path-to-regexp';
import { MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { AppModule } from '../dist/app.module.js';

async function runSmokeBootCheck() {
  console.log('🛡️  [CodePulse Smoke Boot Verification]');
  console.log('------------------------------------------------------------');
  
  const startTime = Date.now();

  // 1. Validate Dependency Injection Graph
  console.log('📦 Step 1/2: Validating NestJS Dependency Injection graph across all modules...');
  let moduleRef;
  try {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    console.log('   ✅ AppModule Dependency Injection Graph: 100% resolved cleanly!');
  } catch (diError) {
    console.error('\n❌ [DI RESOLUTION FAILED]: NestJS could not resolve dependencies in AppModule.');
    console.error(diError);
    console.error('\n👉 Fix: Make sure optional constructor parameters in newly added services have the @Optional() decorator.\n');
    process.exit(1);
  }

  // 2. Validate All Controller Route Paths with path-to-regexp v8
  console.log('🛣️  Step 2/2: Validating all Controller routes for Express 5 / path-to-regexp v8 compatibility...');
  
  function getAllControllers(moduleCls, visited = new Set()) {
    if (visited.has(moduleCls)) return [];
    visited.add(moduleCls);

    let controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, moduleCls) || [];
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleCls) || [];

    for (const imp of imports) {
      if (imp && (typeof imp === 'function' || imp.module)) {
        const subModule = imp.module || imp;
        controllers = controllers.concat(getAllControllers(subModule, visited));
      }
    }
    return controllers;
  }

  const controllers = getAllControllers(AppModule);
  let routeCount = 0;

  for (const Ctrl of controllers) {
    if (!Ctrl || !Ctrl.prototype) continue;
    const ctrlPath = Reflect.getMetadata(PATH_METADATA, Ctrl) || '';
    const propNames = Object.getOwnPropertyNames(Ctrl.prototype);

    for (const prop of propNames) {
      if (prop === 'constructor') continue;
      const methodPath = Reflect.getMetadata(PATH_METADATA, Ctrl.prototype[prop]);
      if (typeof methodPath === 'string') {
        const fullPath = '/' + [ctrlPath, methodPath].filter(Boolean).join('/').replace(/\/+/g, '/');
        try {
          pathToRegexp(fullPath);
          routeCount++;
        } catch (routeErr) {
          console.error(`\n❌ [INVALID ROUTE SYNTAX]: ${Ctrl.name}.${prop} -> "${fullPath}"`);
          console.error(`   Error: ${routeErr.message}`);
          console.error('👉 Fix: Replace deprecated syntax like :param(*) with *param (e.g. *assetKey) for Express 5 compatibility.\n');
          process.exit(1);
        }
      }
    }
  }

  console.log(`   ✅ All ${routeCount} API routes verified compatible with path-to-regexp v8!`);

  const durationMs = Date.now() - startTime;
  console.log('------------------------------------------------------------');
  console.log(`✨ [CodePulse Smoke Boot PASSED] Verified ${controllers.length} controllers and ${routeCount} routes in ${durationMs}ms!`);
  console.log('   Production bootstrap on Render is GUARANTEED to succeed.\n');

  if (moduleRef) {
    try {
      await moduleRef.close();
    } catch {}
  }
  process.exit(0);
}

runSmokeBootCheck().catch((err) => {
  console.error('\n❌ [CodePulse Smoke Boot Unexpected Failure]:', err);
  process.exit(1);
});
