import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vm from 'vm';
import * as vscode from 'vscode';
import {
  ActiveChallengeItem,
  CodePulseBattleTreeProvider,
  PendingBattleInviteItem,
} from './battleView';

export interface TelemetryPacket {
  type: 'KEYSTROKE_DELTA' | 'TEST_RESULT' | 'MATCH_JOIN';
  battleId: string;
  challengeId: string;
  timestampMs: number;
  lineCount: number;
  charCount: number;
  deltaChars: number;
  passRate?: number;
}

export interface SocketTransport {
  send(payload: string): void;
  close(): void;
  readyState: number;
}

export interface ActiveMatchSession {
  battleId: string;
  opponentUsername: string;
  challenge: ActiveChallengeItem;
  workspaceFilePath: string;
  problemFilePath: string;
  startedAtMs: number;
  remainingSeconds: number;
  opponentProgressPct: number;
  lastSyncLatencyMs: number;
}

export interface TestCaseExecutionResult {
  testCaseId: string;
  name: string;
  passed: boolean;
  actualOutput: string;
  expectedOutput: string;
  errorMessage?: string;
  lineNumber: number;
}

export class CodePulseMatchController implements vscode.Disposable {
  private readonly treeProvider = new CodePulseBattleTreeProvider();
  private readonly statusBarItem: vscode.StatusBarItem;
  private readonly failureDecorationType: vscode.TextEditorDecorationType;
  private activeSession: ActiveMatchSession | null = null;
  private timerHandle: NodeJS.Timeout | null = null;
  private socket: SocketTransport | null = null;
  private readonly telemetryLog: TelemetryPacket[] = [];

  constructor(
    private readonly socketFactory?: (url: string) => SocketTransport,
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    );
    this.statusBarItem.command = 'codepulse.runTestCases';
    this.statusBarItem.text = '$(zap) CodePulse: Ready';
    this.statusBarItem.tooltip = 'CodePulse Live Coding Arena';
    this.statusBarItem.show();

    this.failureDecorationType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: 'rgba(239, 68, 68, 0.16)',
      overviewRulerColor: '#ef4444',
      after: {
        color: '#f87171',
        margin: '0 0 0 16px',
      },
    });
  }

  getTreeProvider(): CodePulseBattleTreeProvider {
    return this.treeProvider;
  }

  getActiveSession(): ActiveMatchSession | null {
    return this.activeSession;
  }

  getTelemetryLog(): TelemetryPacket[] {
    return [...this.telemetryLog];
  }

  getStatusBarText(): string {
    return this.statusBarItem.text;
  }

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      this,
      this.statusBarItem,
      this.failureDecorationType,
      vscode.window.registerTreeDataProvider(
        'codepulse.battlesSidebar',
        this.treeProvider,
      ),
      vscode.commands.registerCommand('codepulse.refreshSidebar', () => {
        this.treeProvider.refresh();
        void vscode.window.showInformationMessage(
          'CodePulse Arena refreshed.',
        );
      }),
      vscode.commands.registerCommand(
        'codepulse.startBattle',
        async (challenge?: unknown) => {
          const target = (challenge as ActiveChallengeItem | undefined) ?? this.treeProvider.getChallenges()[0];
          if (target) {
            await this.startMatch({
              battleId: `battle-${Date.now()}`,
              opponentUsername: 'solo_bot',
              challenge: target,
            });
          }
        },
      ),
      vscode.commands.registerCommand(
        'codepulse.acceptInvite',
        async (invite?: unknown) => {
          const target = (invite as PendingBattleInviteItem | undefined) ?? this.treeProvider.getPendingInvites()[0];
          if (!target) {
            void vscode.window.showWarningMessage(
              'No pending battle invites available.',
            );
            return;
          }
          await this.startMatch({
            battleId: target.battleId,
            opponentUsername: target.challengerUsername,
            challenge: target.challenge,
          });
        },
      ),
      vscode.commands.registerCommand('codepulse.runTestCases', async () => {
        await this.runLocalTestCases();
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        this.handleDocumentChange(event);
      }),
    );
  }

  /**
   * Starts a live coding battle: generates temporary workspace solution & problem spec files,
   * opens split editors (solution in Column 1, problem description in Column 2),
   * initializes WebSocket telemetry streaming, and starts the live status bar countdown.
   */
  async startMatch(params: {
    battleId: string;
    opponentUsername: string;
    challenge: ActiveChallengeItem;
  }): Promise<ActiveMatchSession> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codepulse-match-'));
    const ext = params.challenge.language === 'python' ? 'py' : 'ts';
    const workspaceFilePath = path.join(tmpDir, `${params.challenge.id}.${ext}`);
    const problemFilePath = path.join(tmpDir, `${params.challenge.id}.README.md`);

    fs.writeFileSync(workspaceFilePath, params.challenge.starterCode, 'utf8');
    fs.writeFileSync(problemFilePath, params.challenge.problemMarkdown, 'utf8');

    const solutionDoc = await vscode.workspace.openTextDocument(workspaceFilePath);
    await vscode.window.showTextDocument(solutionDoc, vscode.ViewColumn.One, false);

    const problemDoc = await vscode.workspace.openTextDocument(problemFilePath);
    await vscode.window.showTextDocument(problemDoc, vscode.ViewColumn.Two, true);

    this.connectTelemetrySocket(params.battleId);

    this.activeSession = {
      battleId: params.battleId,
      opponentUsername: params.opponentUsername,
      challenge: params.challenge,
      workspaceFilePath,
      problemFilePath,
      startedAtMs: Date.now(),
      remainingSeconds: params.challenge.timeLimitSeconds,
      opponentProgressPct: 0,
      lastSyncLatencyMs: 0,
    };

    this.sendTelemetryPacket({
      type: 'MATCH_JOIN',
      battleId: params.battleId,
      challengeId: params.challenge.id,
      timestampMs: Date.now(),
      lineCount: params.challenge.starterCode.split('\n').length,
      charCount: params.challenge.starterCode.length,
      deltaChars: 0,
    });

    this.startMatchTimer();
    this.updateStatusBar();
    return this.activeSession;
  }

  private connectTelemetrySocket(battleId: string): void {
    this.socket?.close();
    const wsUrl = vscode.workspace
      .getConfiguration('codepulse')
      .get<string>('wsUrl', 'ws://localhost:3001/battles');
    const fullUrl = `${wsUrl}?battleId=${encodeURIComponent(battleId)}`;

    if (this.socketFactory) {
      this.socket = this.socketFactory(fullUrl);
      return;
    }

    const WSImpl = (globalThis as unknown as { WebSocket?: new (url: string) => SocketTransport }).WebSocket;
    if (typeof WSImpl === 'function') {
      try {
        this.socket = new WSImpl(fullUrl);
      } catch {
        this.socket = null;
      }
    }
  }

  /**
   * Syncs keystrokes and editor modifications over WebSockets immediately (0ms debounce)
   * to maintain sub-30ms telemetry latency.
   */
  handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    if (!this.activeSession) return;
    if (event.document.uri.fsPath !== this.activeSession.workspaceFilePath) {
      return;
    }

    const t0 = performance.now();
    const text = event.document.getText();
    const deltaChars = event.contentChanges.reduce(
      (sum, change) => sum + change.text.length - change.rangeLength,
      0,
    );

    this.sendTelemetryPacket({
      type: 'KEYSTROKE_DELTA',
      battleId: this.activeSession.battleId,
      challengeId: this.activeSession.challenge.id,
      timestampMs: Date.now(),
      lineCount: text.split('\n').length,
      charCount: text.length,
      deltaChars,
    });

    this.activeSession.lastSyncLatencyMs = Number(
      (performance.now() - t0).toFixed(3),
    );
  }

  private sendTelemetryPacket(packet: TelemetryPacket): void {
    this.telemetryLog.push(packet);
    if (this.socket && this.socket.readyState === 1) {
      this.socket.send(JSON.stringify(packet));
    }
  }

  /**
   * Executes local test cases against the active match solution and renders
   * inline error decorations directly on failing editor line numbers.
   */
  async runLocalTestCases(): Promise<TestCaseExecutionResult[]> {
    const editor = vscode.window.activeTextEditor;
    const session = this.activeSession;

    if (!session) {
      void vscode.window.showWarningMessage(
        'Start or accept a CodePulse battle before running test cases.',
      );
      return [];
    }

    const sourceCode = editor
      ? editor.document.getText()
      : fs.readFileSync(session.workspaceFilePath, 'utf8');

    const executableJs = sourceCode
      .replace(/export\s+function\s+/g, 'function ')
      .replace(/:\s*number\[\]/g, '')
      .replace(/:\s*string\[\]/g, '')
      .replace(/:\s*\[number,\s*number\]/g, '')
      .replace(/:\s*number/g, '')
      .replace(/:\s*string/g, '')
      .replace(/<number,\s*number>/g, '')
      .replace(/!/g, '');

    const results: TestCaseExecutionResult[] = [];
    const decorations: vscode.DecorationOptions[] = [];

    for (const tc of session.challenge.testCases) {
      const targetLine = Math.max(0, (tc.lineHint ?? 2) - 1);
      try {
        const script = new vm.Script(`${executableJs}\nJSON.stringify(${tc.input});`);
        const actual = String(script.runInNewContext({}, { timeout: 500 }));
        const passed = actual === tc.expectedOutput;

        results.push({
          testCaseId: tc.id,
          name: tc.name,
          passed,
          actualOutput: actual,
          expectedOutput: tc.expectedOutput,
          errorMessage: passed
            ? undefined
            : `Expected ${tc.expectedOutput}, got ${actual}`,
          lineNumber: targetLine + 1,
        });

        if (!passed) {
          decorations.push({
            range: new vscode.Range(
              new vscode.Position(targetLine, 0),
              new vscode.Position(targetLine, 120),
            ),
            hoverMessage: `❌ ${tc.name}: expected ${tc.expectedOutput}, received ${actual}`,
            renderOptions: {
              after: {
                contentText: `  ✖ Failed (${tc.name}): expected ${tc.expectedOutput}, got ${actual}`,
                color: '#f87171',
                margin: '0 0 0 16px',
              },
            },
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          testCaseId: tc.id,
          name: tc.name,
          passed: false,
          actualOutput: 'RUNTIME_ERROR',
          expectedOutput: tc.expectedOutput,
          errorMessage: msg,
          lineNumber: targetLine + 1,
        });
        decorations.push({
          range: new vscode.Range(
            new vscode.Position(targetLine, 0),
            new vscode.Position(targetLine, 120),
          ),
          hoverMessage: `❌ Runtime Error: ${msg}`,
          renderOptions: {
            after: {
              contentText: `  ✖ Runtime Error: ${msg}`,
              color: '#f87171',
              margin: '0 0 0 16px',
            },
          },
        });
      }
    }

    if (editor) {
      editor.setDecorations(this.failureDecorationType, decorations);
    }

    const passedCount = results.filter((r) => r.passed).length;
    const passRate =
      results.length > 0 ? Math.round((passedCount / results.length) * 100) : 0;

    this.sendTelemetryPacket({
      type: 'TEST_RESULT',
      battleId: session.battleId,
      challengeId: session.challenge.id,
      timestampMs: Date.now(),
      lineCount: sourceCode.split('\n').length,
      charCount: sourceCode.length,
      deltaChars: 0,
      passRate,
    });

    if (passedCount === results.length) {
      void vscode.window.showInformationMessage(
        `CodePulse: All ${results.length}/${results.length} test cases passed!`,
      );
    } else {
      void vscode.window.showErrorMessage(
        `CodePulse: ${passedCount}/${results.length} test cases passed. Check inline editor decorations.`,
      );
    }

    return results;
  }

  updateOpponentProgress(progressPct: number): void {
    if (!this.activeSession) return;
    this.activeSession.opponentProgressPct = Math.max(
      0,
      Math.min(100, progressPct),
    );
    this.updateStatusBar();
  }

  private startMatchTimer(): void {
    if (this.timerHandle) clearInterval(this.timerHandle);
    this.timerHandle = setInterval(() => {
      if (!this.activeSession) return;
      this.activeSession.remainingSeconds = Math.max(
        0,
        this.activeSession.remainingSeconds - 1,
      );
      this.updateStatusBar();
    }, 1000);
    this.timerHandle.unref?.();
  }

  private updateStatusBar(): void {
    if (!this.activeSession) {
      this.statusBarItem.text = '$(zap) CodePulse: Ready';
      return;
    }
    const mins = Math.floor(this.activeSession.remainingSeconds / 60);
    const secs = String(this.activeSession.remainingSeconds % 60).padStart(
      2,
      '0',
    );
    this.statusBarItem.text = `$(flame) Battle vs @${this.activeSession.opponentUsername} | ${mins}:${secs} | Opp: ${this.activeSession.opponentProgressPct}%`;
  }

  dispose(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
    this.socket?.close();
  }
}

let controllerInstance: CodePulseMatchController | null = null;

export function activate(context: vscode.ExtensionContext): CodePulseMatchController {
  controllerInstance = new CodePulseMatchController();
  controllerInstance.register(context);
  return controllerInstance;
}

export function deactivate(): void {
  controllerInstance?.dispose();
  controllerInstance = null;
}
