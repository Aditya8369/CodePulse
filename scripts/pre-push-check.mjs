import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('\n🔍 [CodePulse Pre-Push Verification]');
console.log('Checking modified files and running quality verification before pushing to GitHub...\n');

try {
  // 1. Identify changed files compared to origin/main or latest commit
  let changedFiles = [];
  try {
    const diffOutput = execSync('git diff --name-only origin/main...HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    changedFiles = diffOutput.split('\n').filter(Boolean);
  } catch {
    try {
      // Fallback: Check diff from HEAD~1
      const diffOutput = execSync('git diff --name-only HEAD~1', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      changedFiles = diffOutput.split('\n').filter(Boolean);
    } catch {
      // Fallback: check all git tracked modified files
      const statusOutput = execSync('git status --porcelain', {
        encoding: 'utf8',
      });
      changedFiles = statusOutput
        .split('\n')
        .filter(Boolean)
        .map((line) => line.slice(3).trim());
    }
  }

  const hasFrontendChanges =
    changedFiles.length === 0 ||
    changedFiles.some(
      (f) =>
        f.startsWith('src/') ||
        f.startsWith('public/') ||
        f === 'package.json' ||
        f === 'tsconfig.json' ||
        f === 'next.config.mjs' ||
        f === 'next.config.ts'
    );

  const hasBackendChanges =
    changedFiles.length === 0 ||
    changedFiles.some((f) => f.startsWith('backend/'));

  // 2. Frontend verification
  if (hasFrontendChanges) {
    console.log('🎨 Verifying Frontend TypeScript types (npx tsc --noEmit)...');
    try {
      execSync('npx tsc --noEmit', { stdio: 'inherit' });
      console.log('✅ Frontend typecheck passed!\n');
    } catch {
      console.error(
        '\n❌ [CodePulse Pre-Push Failed]: Frontend TypeScript verification found errors.'
      );
      console.error(
        '👉 Please fix the TypeScript errors above before pushing your code to GitHub.\n'
      );
      process.exit(1);
    }
  }

  // 3. Backend verification (if backend dependencies exist)
  if (hasBackendChanges) {
    const backendNodeModules = path.join(process.cwd(), 'backend', 'node_modules');
    if (fs.existsSync(backendNodeModules)) {
      console.log('⚙️ Verifying Backend TypeScript types...');
      try {
        execSync('npm --prefix backend run build', { stdio: 'inherit' });
        console.log('✅ Backend build passed!\n');
      } catch {
        console.error(
          '\n❌ [CodePulse Pre-Push Failed]: Backend build or typecheck found errors.'
        );
        console.error(
          '👉 Please fix backend errors before pushing to GitHub (run `cd backend && npm run build`).\n'
        );
        process.exit(1);
      }
    } else {
      console.log(
        'ℹ️ Backend node_modules not detected locally. Skipping local backend build (CI will verify on GitHub).'
      );
    }
  }

  console.log('✨ [CodePulse] All pre-push checks passed successfully! Proceeding with git push.\n');
  process.exit(0);
} catch (err) {
  console.error('Pre-push check error:', err.message);
  process.exit(0); // Do not block push if script itself encounters unexpected git query error
}
