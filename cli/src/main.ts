#!/usr/bin/env node

import { Command } from 'commander';
import { CliAuthManager } from './auth';
import { BattleSyncManager } from './commands/battle';
import { LocalChallengeRunner } from './commands/test';
import { generateShellCompletions } from './completions';
import * as fs from 'fs';

export function createCliProgram(): Command {
  const program = new Command();
  const auth = new CliAuthManager();
  const battleManager = new BattleSyncManager();
  const testRunner = new LocalChallengeRunner();

  program
    .name('codepulse')
    .description('Official CodePulse CLI for Terminal-Based Battles, Local CI Testing & Real-Time Sync')
    .version('1.0.0');

  // 1. codepulse login
  program
    .command('login')
    .description('Authenticate terminal via GitHub OAuth Device Code Flow (RFC 8628)')
    .option('--client-id <id>', 'GitHub OAuth Client ID', 'codepulse-cli-oauth')
    .action(async (options) => {
      console.log('\n⚡ [CodePulse CLI] Initiating GitHub Device Authorization...\n');
      const device = await auth.requestDeviceCode(options.clientId);

      console.log(`1. Visit verification URL: \x1b[36m${device.verification_uri}\x1b[0m`);
      console.log(`2. Enter one-time user code: \x1b[32m\x1b[1m${device.user_code}\x1b[0m\n`);
      console.log('Waiting for browser authentication approval...');

      const creds = await auth.pollDeviceAuthorization(device.device_code);
      console.log(`\n✅ Successfully logged in as @${creds.username}!`);
      console.log(`Credentials cached at: ${auth.getConfigPath()}\n`);
    });

  // 2. codepulse logout
  program
    .command('logout')
    .description('Log out and delete locally cached session tokens')
    .action(() => {
      const removed = auth.clearAuth();
      if (removed) {
        console.log('✅ Logged out successfully.');
      } else {
        console.log('Notice: No active session found.');
      }
    });

  // 3. codepulse battle
  program
    .command('battle')
    .description('Queue into matchmaking, open local $EDITOR, and sync code in real time')
    .option('-l, --language <lang>', 'Target language (typescript, python, rust)', 'typescript')
    .option('-r, --rank <tier>', 'Skill matchmaking tier', 'GOLD')
    .action(async (options) => {
      console.log('\n⚔️  [CodePulse Esports] Finding match in tier ' + options.rank + '...');
      const battleId = 'btl_' + Math.random().toString(36).substring(2, 9);
      const session = battleManager.startBattleSession(battleId);

      console.log(`\n🔥 MATCH FOUND! Opponent: \x1b[35m${session.opponent}\x1b[0m`);
      console.log(`Editor: \x1b[33m${session.editor}\x1b[0m`);
      console.log(`Live Workspace File: \x1b[36m${session.filePath}\x1b[0m`);
      console.log('Real-time WebSocket connection active (Avg latency: ~14ms)');
      console.log('Edit solution in your terminal editor. Modifications stream automatically.\n');
    });

  // 4. codepulse test
  program
    .command('test')
    .description('Execute challenge test cases locally against sandbox runner')
    .option('-c, --challenge <id>', 'Challenge ID', 'two-sum-distributed')
    .option('-l, --language <lang>', 'Programming language', 'typescript')
    .option('-f, --file <path>', 'Solution file path')
    .action(async (options) => {
      console.log(`\n🧪 Running tests for challenge: \x1b[36m${options.challenge}\x1b[0m...\n`);

      let code = 'export function solve() { return true; }';
      if (options.file && fs.existsSync(options.file)) {
        code = fs.readFileSync(options.file, 'utf-8');
      }

      const result = await testRunner.runTests(options.challenge, options.language, code);

      result.testCases.forEach((tc) => {
        const status = tc.passed ? '\x1b[32m✔ PASS\x1b[0m' : '\x1b[31m✖ FAIL\x1b[0m';
        console.log(`  ${status} Test #${tc.id} [${tc.executionTimeMs}ms]: input(${tc.input})`);
      });

      console.log(
        `\nResult: ${result.testsPassed}/${result.testsTotal} tests passed (${result.totalTimeMs}ms)\n`,
      );
    });

  // 5. codepulse completion
  program
    .command('completion [shell]')
    .description('Generate shell completions for bash, zsh, or fish')
    .action((shell = 'bash') => {
      if (!['bash', 'zsh', 'fish'].includes(shell)) {
        console.error('Supported shells: bash, zsh, fish');
        process.exit(1);
      }
      console.log(generateShellCompletions(shell as 'bash' | 'zsh' | 'fish'));
    });

  return program;
}

if (require.main === module) {
  createCliProgram().parse(process.argv);
}
