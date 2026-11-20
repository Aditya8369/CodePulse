import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { describe, it } from 'node:test';
import Module = require('node:module');

// Provide a lightweight VS Code API test harness so tests run both in Node & @vscode/test-electron
const commandsMap = new Map<string, (...args: unknown[]) => unknown>();
const changeListeners: Array<(e: unknown) => void> = [];
const openedDocs: Array<{ fsPath: string; content: string; languageId: string; version: number }> = [];
const appliedDecorations: Array<{ ranges: unknown[] }> = [];

const vscodeMock = {
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  StatusBarAlignment: { Left: 1, Right: 2 },
  ViewColumn: { Active: -1, Beside: -2, One: 1, Two: 2, Three: 3 },
  ThemeIcon: class ThemeIcon {
    constructor(public readonly id: string) {}
  },
  TreeItem: class TreeItem {
    constructor(
      public label?: string,
      public collapsibleState?: number,
    ) {}
  },
  EventEmitter: class EventEmitter<T> {
    private listeners: Array<(e: T) => void> = [];
    event = (listener: (e: T) => void) => {
      this.listeners.push(listener);
      return { dispose: () => {} };
    };
    fire(data?: T) {
      for (const l of this.listeners) l(data as T);
    }
    dispose() {}
  },
  Position: class Position {
    constructor(
      public readonly line: number,
      public readonly character: number,
    ) {}
  },
  Range: class Range {
    constructor(
      public readonly start: unknown,
      public readonly end: unknown,
    ) {}
  },
  window: {
    activeTextEditor: undefined as unknown,
    registerTreeDataProvider: () => ({ dispose: () => {} }),
    createStatusBarItem: () => ({
      text: '',
      tooltip: '',
      command: '',
      show: () => {},
      hide: () => {},
      dispose: () => {},
    }),
    createTextEditorDecorationType: () => ({
      key: 'codepulse-fail-dec',
      dispose: () => {},
    }),
    showTextDocument: async (doc: { fsPath: string; content: string; languageId: string; version: number }) => {
      const editor = {
        document: {
          uri: { fsPath: doc.fsPath, toString: () => doc.fsPath },
          languageId: doc.languageId,
          version: doc.version,
          getText: () => fs.readFileSync(doc.fsPath, 'utf8'),
        },
        setDecorations: (_type: unknown, ranges: unknown[]) => {
          appliedDecorations.push({ ranges });
        },
      };
      if (!doc.fsPath.endsWith('.md')) {
        vscodeMock.window.activeTextEditor = editor;
      }
      return editor;
    },
    showInformationMessage: async () => undefined,
    showWarningMessage: async () => undefined,
    showErrorMessage: async () => undefined,
  },
  workspace: {
    openTextDocument: async (filePath: string) => {
      const doc = {
        fsPath: filePath,
        content: fs.readFileSync(filePath, 'utf8'),
        languageId: filePath.endsWith('.md') ? 'markdown' : 'typescript',
        version: 1,
      };
      openedDocs.push(doc);
      return doc;
    },
    onDidChangeTextDocument: (listener: (e: unknown) => void) => {
      changeListeners.push(listener);
      return { dispose: () => {} };
    },
    getConfiguration: () => ({
      get: <T>(_key: string, def: T) => def,
    }),
  },
  commands: {
    registerCommand: (cmd: string, cb: (...args: unknown[]) => unknown) => {
      commandsMap.set(cmd, cb);
      return { dispose: () => {} };
    },
  },
};

const origLoad = (Module as unknown as { _load: (req: string, parent: unknown, isMain: boolean) => unknown })._load;
(Module as unknown as { _load: (req: string, parent: unknown, isMain: boolean) => unknown })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === 'vscode') return vscodeMock;
  return origLoad.apply(this, [request, parent, isMain]);
};

import { CodePulseMatchController } from '../extension';

describe('CodePulse VS Code Extension Suite', () => {
  it('populates Activity Bar TreeDataProvider with Pending Invites, Active Challenges, and Online Friends', () => {
    const controller = new CodePulseMatchController();
    const tree = controller.getTreeProvider();
    const roots = tree.getChildren();

    assert.equal(roots.length, 3);
    assert.ok(roots[0].label?.includes('Pending Battle Invites'));
    assert.ok(roots[1].label?.includes('Active Challenges'));
    assert.ok(roots[2].label?.includes('Online Friends'));

    const invites = tree.getChildren(roots[0]);
    assert.equal(invites.length, 1);
    assert.ok(invites[0].label?.includes('@arjun_dev'));
    controller.dispose();
  });

  it('accepts a battle invite, opens split editors, syncs keystrokes over WebSockets in <30ms, and updates status bar', async () => {
    const sentFrames: string[] = [];
    const controller = new CodePulseMatchController(() => ({
      readyState: 1,
      send: (payload: string) => sentFrames.push(payload),
      close: () => {},
    }));

    const subscriptions: Array<{ dispose(): unknown }> = [];
    controller.register({ subscriptions });

    const invite = controller.getTreeProvider().getPendingInvites()[0];
    const session = await controller.startMatch({
      battleId: invite.battleId,
      opponentUsername: invite.challengerUsername,
      challenge: invite.challenge,
    });

    assert.equal(session.battleId, 'battle-live-501');
    assert.ok(fs.existsSync(session.workspaceFilePath));
    assert.ok(fs.existsSync(session.problemFilePath));

    // Simulate keystroke edit and measure WebSocket telemetry latency (<30ms)
    controller.handleDocumentChange({
      document: {
        uri: {
          fsPath: session.workspaceFilePath,
          toString: () => session.workspaceFilePath,
        },
        languageId: 'typescript',
        version: 2,
        getText: () => 'export function solve(nums: number[], target: number) { return [0, 1]; }',
      },
      contentChanges: [{ rangeOffset: 0, rangeLength: 0, text: 'return [0, 1];' }],
    });

    assert.ok(session.lastSyncLatencyMs < 30, `Expected <30ms sync latency, got ${session.lastSyncLatencyMs}ms`);
    assert.ok(sentFrames.length >= 2);

    controller.updateOpponentProgress(65);
    assert.ok(controller.getStatusBarText().includes('Opp: 65%'));
    controller.dispose();
  });

  it('runs local test cases and renders inline editor error decorations on failing lines', async () => {
    appliedDecorations.length = 0;
    const controller = new CodePulseMatchController();
    const challenge = controller.getTreeProvider().getChallenges()[0];
    const session = await controller.startMatch({
      battleId: 'battle-test-dec',
      opponentUsername: 'meera_codes',
      challenge,
    });

    // Starter code returns [-1, -1] which fails test cases and triggers inline error decorations
    const results = await controller.runLocalTestCases();
    assert.equal(results.length, 2);
    assert.equal(results[0].passed, false);
    assert.ok(appliedDecorations.length > 0);
    assert.equal(appliedDecorations[appliedDecorations.length - 1].ranges.length, 2);

    // Write valid O(n) solution and re-run test cases -> 0 error decorations
    const validSolution = `export function solve(nums: number[], target: number): [number, number] {
  const seen = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need)!, i];
    seen.set(nums[i], i);
  }
  return [-1, -1];
}`;
    fs.writeFileSync(session.workspaceFilePath, validSolution, 'utf8');
    const passingResults = await controller.runLocalTestCases();
    assert.equal(passingResults.every((r) => r.passed), true);
    assert.equal(appliedDecorations[appliedDecorations.length - 1].ranges.length, 0);
    controller.dispose();
  });
});
