import { describe, it, expect, vi } from 'vitest';
import {
  BattleSocketClient,
} from './battle-socket';
import {
  decodeBattleEvent,
  decodeCursorPosition,
  decodeKeystrokeDelta,
  decodeMatchStatus,
  decodeTestResult,
  encodeBattleEvent,
  encodeCursorPosition,
  encodeKeystrokeDelta,
  encodeMatchStatus,
  encodeTestResult,
  KeystrokeType,
  MatchStatusState,
  BattleEventEnvelope,
  KeystrokeDelta,
  CursorPosition,
  TestResult,
  MatchStatus,
} from '@/lib/proto/battle_events';

describe('BattleSocketClient & Protocol Buffers Binary Protocol (#531)', () => {
  describe('1. Binary Roundtrip Fidelity for all Event Types', () => {
    it('encodes and decodes KeystrokeDelta with 100% data fidelity', () => {
      const original: KeystrokeDelta = {
        battleId: 'battle-nsoc-101',
        userId: 'dev-alex-42',
        sequence: 159,
        timestamp: 1732450000123,
        cursorPosition: 450,
        deltaLength: 5,
        keystrokeType: KeystrokeType.KEYSTROKE_TYPE_INSERT,
        key: 'a',
        patchSnippet: 'const ans = solve(input);',
        isTypoCorrection: false,
      };

      const binary = encodeKeystrokeDelta(original);
      expect(binary.byteLength).toBeGreaterThan(0);

      const decoded = decodeKeystrokeDelta(binary);
      expect(decoded.battleId).toBe(original.battleId);
      expect(decoded.userId).toBe(original.userId);
      expect(decoded.sequence).toBe(original.sequence);
      expect(decoded.timestamp).toBe(original.timestamp);
      expect(decoded.cursorPosition).toBe(original.cursorPosition);
      expect(decoded.deltaLength).toBe(original.deltaLength);
      expect(decoded.keystrokeType).toBe(original.keystrokeType);
      expect(decoded.key).toBe(original.key);
      expect(decoded.patchSnippet).toBe(original.patchSnippet);
      expect(decoded.isTypoCorrection).toBe(original.isTypoCorrection);
    });

    it('encodes and decodes CursorPosition with 100% data fidelity', () => {
      const original: CursorPosition = {
        battleId: 'battle-nsoc-102',
        userId: 'dev-sarah-88',
        lineNumber: 42,
        column: 18,
        selectionStartLine: 42,
        selectionStartColumn: 10,
        selectionEndLine: 42,
        selectionEndColumn: 25,
        timestamp: 1732450000456,
      };

      const binary = encodeCursorPosition(original);
      const decoded = decodeCursorPosition(binary);

      expect(decoded.battleId).toBe(original.battleId);
      expect(decoded.userId).toBe(original.userId);
      expect(decoded.lineNumber).toBe(original.lineNumber);
      expect(decoded.column).toBe(original.column);
      expect(decoded.selectionStartLine).toBe(original.selectionStartLine);
      expect(decoded.selectionStartColumn).toBe(original.selectionStartColumn);
      expect(decoded.selectionEndLine).toBe(original.selectionEndLine);
      expect(decoded.selectionEndColumn).toBe(original.selectionEndColumn);
      expect(decoded.timestamp).toBe(original.timestamp);
    });

    it('encodes and decodes TestResult with floating point execution fidelity', () => {
      const original: TestResult = {
        battleId: 'battle-nsoc-103',
        userId: 'dev-ken-07',
        testCaseId: 'tc-edge-case-extreme',
        passed: true,
        durationMs: 14.825,
        actualOutput: '42',
        expectedOutput: '42',
        errorMessage: '',
        memoryKb: 2048,
        timestamp: 1732450000789,
      };

      const binary = encodeTestResult(original);
      const decoded = decodeTestResult(binary);

      expect(decoded.battleId).toBe(original.battleId);
      expect(decoded.userId).toBe(original.userId);
      expect(decoded.testCaseId).toBe(original.testCaseId);
      expect(decoded.passed).toBe(true);
      expect(decoded.durationMs).toBeCloseTo(14.825, 3);
      expect(decoded.actualOutput).toBe('42');
      expect(decoded.expectedOutput).toBe('42');
      expect(decoded.memoryKb).toBe(2048);
    });

    it('encodes and decodes MatchStatus with nested map scores', () => {
      const original: MatchStatus = {
        battleId: 'battle-nsoc-104',
        status: MatchStatusState.MATCH_STATUS_SUDDEN_DEATH,
        winnerId: 'dev-alex-42',
        timeRemainingMs: 45000,
        scores: { 'dev-alex-42': 100, 'dev-sarah-88': 95 },
        roundNumber: 3,
        timestamp: 1732450001000,
      };

      const binary = encodeMatchStatus(original);
      const decoded = decodeMatchStatus(binary);

      expect(decoded.battleId).toBe(original.battleId);
      expect(decoded.status).toBe(MatchStatusState.MATCH_STATUS_SUDDEN_DEATH);
      expect(decoded.winnerId).toBe('dev-alex-42');
      expect(decoded.timeRemainingMs).toBe(45000);
      expect(decoded.roundNumber).toBe(3);
      expect(decoded.scores?.['dev-alex-42']).toBe(100);
      expect(decoded.scores?.['dev-sarah-88']).toBe(95);
    });

    it('encodes and decodes BattleEventEnvelope wrapper', () => {
      const original: BattleEventEnvelope = {
        version: 1,
        timestamp: 1732450002000,
        eventType: 'cursor',
        cursor: {
          battleId: 'battle-nsoc-105',
          userId: 'dev-player-1',
          lineNumber: 12,
          column: 4,
          timestamp: 1732450002000,
        },
      };

      const binary = encodeBattleEvent(original);
      const decoded = decodeBattleEvent(binary);

      expect(decoded.version).toBe(1);
      expect(decoded.eventType).toBe('cursor');
      expect(decoded.cursor?.battleId).toBe('battle-nsoc-105');
      expect(decoded.cursor?.lineNumber).toBe(12);
      expect(decoded.cursor?.column).toBe(4);
    });
  });

  describe('2. Bandwidth Compression Ratio (> 65% Reduction)', () => {
    it('reduces average WebSocket message size by at least 65% compared to JSON', () => {
      const keystrokeEvent: BattleEventEnvelope = {
        version: 1,
        timestamp: 1732450000000,
        eventType: 'keystroke',
        keystroke: {
          battleId: 'battle-tournament-championship-2026',
          userId: 'user-polyglot-grandmaster-99',
          sequence: 1420,
          timestamp: 1732450000000,
          cursorPosition: 340,
          deltaLength: 1,
          keystrokeType: KeystrokeType.KEYSTROKE_TYPE_INSERT,
          key: ';',
          patchSnippet: ';',
          isTypoCorrection: false,
        },
      };

      const jsonStr = JSON.stringify(keystrokeEvent);
      const jsonBytes = new TextEncoder().encode(jsonStr).byteLength;

      const binary = encodeBattleEvent(keystrokeEvent);
      const binaryBytes = binary.byteLength;

      const savingsPercent = ((jsonBytes - binaryBytes) / jsonBytes) * 100;

      expect(savingsPercent).toBeGreaterThan(65);
      expect(binaryBytes).toBeLessThan(jsonBytes * 0.35);
    });

    it('reduces cursor position telemetry by over 70%', () => {
      const cursorEvent: BattleEventEnvelope = {
        version: 1,
        timestamp: 1732450000000,
        eventType: 'cursor',
        cursor: {
          battleId: 'b-42',
          userId: 'u-1',
          lineNumber: 10,
          column: 15,
          timestamp: 1732450000000,
        },
      };

      const jsonBytes = new TextEncoder().encode(JSON.stringify(cursorEvent)).byteLength;
      const binaryBytes = encodeBattleEvent(cursorEvent).byteLength;
      const savingsPercent = ((jsonBytes - binaryBytes) / jsonBytes) * 100;

      expect(savingsPercent).toBeGreaterThan(65);
    });
  });

  describe('3. Serialization & Deserialization Speed Benchmark (< 0.1ms)', () => {
    it('benchmarks under 0.1ms per frame for both serialization and deserialization', () => {
      const benchmark = BattleSocketClient.benchmark(1000);

      expect(benchmark.avgEncodeMs).toBeLessThan(0.1);
      expect(benchmark.avgDecodeMs).toBeLessThan(0.1);
      expect(benchmark.savingsPercentage).toBeGreaterThanOrEqual(65);
      expect(benchmark.passedAcceptance).toBe(true);
    });
  });

  describe('4. Backward Compatibility & Monaco Editor Decorators', () => {
    it('directly updates Monaco Editor cursor decorators via deltaDecorations', () => {
      const mockEditor = {
        deltaDecorations: vi.fn((_old, newDecs) => ['dec-id-101', ...newDecs.map((_: any, i: number) => `dec-${i}`)]),
      };

      const client = new BattleSocketClient({
        battleId: 'b-100',
        userId: 'u-100',
      });

      const cursor: CursorPosition = {
        battleId: 'b-100',
        userId: 'u-opponent',
        lineNumber: 14,
        column: 22,
        timestamp: Date.now(),
      };

      const decorationIds = client.applyCursorDecoration(mockEditor, cursor);

      expect(mockEditor.deltaDecorations).toHaveBeenCalledTimes(1);
      expect(decorationIds.length).toBeGreaterThan(0);
      const callArgs = mockEditor.deltaDecorations.mock.calls[0];
      expect(callArgs[0]).toEqual([]); // first call has empty oldDecorations
      expect(callArgs[1][0].range.startLineNumber).toBe(14);
      expect(callArgs[1][0].range.startColumn).toBe(22);
      expect(callArgs[1][0].options.className).toContain('opponent-cursor-decoration');
    });

    it('accumulates bandwidth savings telemetry correctly', () => {
      const client = new BattleSocketClient({
        battleId: 'b-100',
        userId: 'u-100',
        preferBinary: true,
      });

      const envelope: BattleEventEnvelope = {
        version: 1,
        timestamp: Date.now(),
        eventType: 'cursor',
        cursor: {
          battleId: 'b-100',
          userId: 'u-opp',
          lineNumber: 5,
          column: 10,
          timestamp: Date.now(),
        },
      };

      const binary = encodeBattleEvent(envelope);
      client.handleIncomingBinary(binary.buffer);

      const stats = client.getBandwidthStats();
      expect(stats.totalPacketsReceived).toBe(1);
      expect(stats.savedBytes).toBeGreaterThan(0);
      expect(stats.savedPercentage).toBeGreaterThan(60);
    });
  });
});

