import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CliAuthManager } from './auth';
import { BattleSyncManager } from './commands/battle';
import { LocalChallengeRunner } from './commands/test';
import { generateShellCompletions } from './completions';
import { createCliProgram } from './main';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('CodePulse Official CLI Suite', () => {
  let tempConfigPath: string;
  let authManager: CliAuthManager;

  beforeEach(() => {
    tempConfigPath = path.join(os.tmpdir(), `codepulse-test-${Date.now()}.json`);
    authManager = new CliAuthManager(tempConfigPath);
  });

  afterEach(() => {
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }
  });

  describe('OAuth Device Authorization & Token Caching (RFC 8628)', () => {
    it('requests GitHub device code with verification URI and user code', async () => {
      const device = await authManager.requestDeviceCode('test-client-id');
      expect(device.device_code).toBeDefined();
      expect(device.user_code).toMatch(/^CP-\d{4}$/);
      expect(device.verification_uri).toBe('https://github.com/login/device');
      expect(device.expires_in).toBeGreaterThan(0);
    });

    it('saves and loads authenticated session tokens to local config cache', async () => {
      expect(authManager.loadAuth()).toBeNull();

      const creds = await authManager.pollDeviceAuthorization('mock-device-code', true);
      expect(creds.username).toBe('terminal-dev');
      expect(creds.accessToken).toMatch(/^cp_pat_/);

      const loaded = authManager.loadAuth();
      expect(loaded).not.toBeNull();
      expect(loaded?.username).toBe('terminal-dev');
      expect(loaded?.accessToken).toBe(creds.accessToken);
    });

    it('clears stored session tokens on logout', async () => {
      await authManager.pollDeviceAuthorization('mock-device-code', true);
      expect(authManager.clearAuth()).toBe(true);
      expect(authManager.loadAuth()).toBeNull();
    });
  });

  describe('Battle Matchmaking & Real-Time Live Sync', () => {
    let battleManager: BattleSyncManager;

    beforeEach(() => {
      battleManager = new BattleSyncManager();
    });

    it('resolves preferred terminal editor from environment or platform default', () => {
      const editor = battleManager.resolveEditor();
      expect(editor).toBeDefined();
      expect(typeof editor).toBe('string');
    });

    it('creates local battle workspace and starts match session', () => {
      const session = battleManager.startBattleSession('battle_123');
      expect(session.battleId).toBe('battle_123');
      expect(session.status).toBe('IN_BATTLE');
      expect(fs.existsSync(session.filePath)).toBe(true);
    });

    it('synchronizes local file modifications with sub-20ms WebSocket latency', () => {
      battleManager.startBattleSession('battle_123');
      const msg = battleManager.syncFileContent('function solution() { return 42; }');

      expect(msg.type).toBe('sync');
      expect(msg.code).toContain('return 42');

      const latency = battleManager.getAverageLatencyMs();
      expect(latency).toBeLessThan(20); // Sub-20ms requirement
    });
  });

  describe('Local CI Challenge Runner', () => {
    it('runs challenge test suite locally against sandbox', async () => {
      const runner = new LocalChallengeRunner();
      const result = await runner.runTests(
        'two-sum-distributed',
        'typescript',
        'export function solve() { return true; }',
      );

      expect(result.testsTotal).toBe(4);
      expect(result.testsPassed).toBe(4);
      expect(result.allPassed).toBe(true);
      expect(result.totalTimeMs).toBeGreaterThan(0);
    });

    it('handles failing test cases and execution errors gracefully', async () => {
      const runner = new LocalChallengeRunner();
      const result = await runner.runTests(
        'two-sum-distributed',
        'typescript',
        'throw new Error("syntax_error")',
      );

      expect(result.allPassed).toBe(false);
      expect(result.testsPassed).toBe(0);
    });
  });

  describe('Shell Completion Generation', () => {
    it('generates shell completion scripts for bash, zsh, and fish', () => {
      const bash = generateShellCompletions('bash');
      expect(bash).toContain('_codepulse_completions');

      const zsh = generateShellCompletions('zsh');
      expect(zsh).toContain('#compdef codepulse');

      const fish = generateShellCompletions('fish');
      expect(fish).toContain('complete -c codepulse');
    });
  });

  describe('Commander CLI Program Options', () => {
    it('registers commands: login, logout, battle, test, completion', () => {
      const program = createCliProgram();
      const commandNames = program.commands.map((c) => c.name());
      expect(commandNames).toContain('login');
      expect(commandNames).toContain('logout');
      expect(commandNames).toContain('battle');
      expect(commandNames).toContain('test');
      expect(commandNames).toContain('completion');
    });
  });
});
