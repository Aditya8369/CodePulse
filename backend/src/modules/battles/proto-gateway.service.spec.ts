import { ProtoGatewayService } from './proto-gateway.service';
import {
  BattleEventEnvelope,
  CursorPosition,
  KeystrokeDelta,
  KeystrokeType,
  MatchStatus,
  MatchStatusState,
  TestResult,
  encodeBattleEvent,
} from './proto/battle_events';

describe('ProtoGatewayService (Protocol Buffers Binary Streaming #531)', () => {
  let service: ProtoGatewayService;

  beforeEach(() => {
    service = new ProtoGatewayService();
  });

  describe('1. Header & Protocol Negotiation', () => {
    it('negotiates binary encoding when Accept header contains application/x-protobuf', () => {
      const encoding = service.negotiateEncoding({
        headers: { accept: 'application/x-protobuf, text/html' },
      });
      expect(encoding).toBe('binary');
    });

    it('negotiates binary encoding when sec-websocket-protocol contains protobuf', () => {
      const encoding = service.negotiateEncoding({
        headers: { 'sec-websocket-protocol': 'codepulse.battle, application/x-protobuf' },
      });
      expect(encoding).toBe('binary');
    });

    it('negotiates binary encoding when query parameter has encoding=protobuf', () => {
      const encoding = service.negotiateEncoding({
        query: { encoding: 'protobuf' },
      });
      expect(encoding).toBe('binary');
    });

    it('falls back to json when binary encoding is not requested', () => {
      const encoding = service.negotiateEncoding({
        headers: { accept: 'application/json' },
        query: {},
      });
      expect(encoding).toBe('json');
    });

    it('handles empty handshake gracefully with json fallback', () => {
      expect(service.negotiateEncoding({} as any)).toBe('json');
    });
  });

  describe('2. Payload Encoding & Decoding', () => {
    it('encodes and decodes keystroke event with high compression', () => {
      const keystrokeData = {
        battleId: 'b-tournament-final',
        userId: 'usr-champ',
        sequence: 420,
        cursorPosition: 128,
        delta: 'const total = items.reduce((a, b) => a + b, 0);',
        key: 'Enter',
        timestamp: 1732456000000,
      };

      const arrayBuffer = service.encodeBinaryPayload('keystroke', keystrokeData);
      expect(arrayBuffer.byteLength).toBeGreaterThan(0);

      const decoded = service.decodeBinaryPayload(arrayBuffer);
      expect(decoded.battleId).toBe(keystrokeData.battleId);
      expect(decoded.userId).toBe(keystrokeData.userId);
      expect(decoded.sequence).toBe(keystrokeData.sequence);
      expect(decoded.cursorPosition).toBe(keystrokeData.cursorPosition);
      expect(decoded.patchSnippet).toBe(keystrokeData.delta);
    });

    it('encodes and decodes cursor move payload', () => {
      const cursorData = {
        battleId: 'b-999',
        userId: 'usr-guest',
        lineNumber: 15,
        column: 8,
        selectionStartLine: 15,
        selectionStartColumn: 1,
        selectionEndLine: 15,
        selectionEndColumn: 20,
        timestamp: Date.now(),
      };

      const arrayBuffer = service.encodeBinaryPayload('cursor', cursorData);
      const decoded = service.decodeBinaryPayload(arrayBuffer);

      expect(decoded.battleId).toBe(cursorData.battleId);
      expect(decoded.lineNumber).toBe(cursorData.lineNumber);
      expect(decoded.column).toBe(cursorData.column);
      expect(decoded.selectionEndColumn).toBe(cursorData.selectionEndColumn);
    });

    it('encodes and decodes test result payload', () => {
      const testData = {
        battleId: 'b-999',
        userId: 'usr-guest',
        testCaseId: 'tc-prime-factors',
        passed: true,
        durationMs: 3.45,
        actualOutput: '[2, 3, 5]',
        expectedOutput: '[2, 3, 5]',
        timestamp: Date.now(),
      };

      const arrayBuffer = service.encodeBinaryPayload('test_result', testData);
      const decoded = service.decodeBinaryPayload(arrayBuffer);

      expect(decoded.battleId).toBe(testData.battleId);
      expect(decoded.testCaseId).toBe(testData.testCaseId);
      expect(decoded.passed).toBe(true);
      expect(decoded.durationMs).toBeCloseTo(3.45, 2);
    });

    it('falls back seamlessly to stringified JSON if incoming message is JSON string', () => {
      const rawJson = JSON.stringify({
        battleId: 'b-json-fallback',
        userId: 'u-1',
        delta: 'code',
      });

      const decoded = service.decodeBinaryPayload(rawJson);
      expect(decoded.battleId).toBe('b-json-fallback');
      expect(decoded.delta).toBe('code');
    });
  });

  describe('3. Bandwidth Savings Telemetry Tracking', () => {
    it('records bandwidth and calculates > 65% savings for active battle', () => {
      const battleId = 'b-active-esports-match';
      const jsonBytes = 250;
      const binaryBytes = 70; // ~72% savings

      const record1 = service.recordBandwidth(battleId, 'keystroke', jsonBytes, binaryBytes, true);
      expect(record1.totalEvents).toBe(1);
      expect(record1.binaryEvents).toBe(1);
      expect(record1.totalBinaryBytesTransferred).toBe(70);
      expect(record1.totalJsonBytesEquivalent).toBe(250);
      expect(record1.savedBytes).toBe(180);
      expect(record1.savedPercentage).toBe(72);

      // Record another event
      const record2 = service.recordBandwidth(battleId, 'cursor', 180, 50, true);
      expect(record2.totalEvents).toBe(2);
      expect(record2.savedBytes).toBe(180 + 130);
      expect(record2.savedPercentage).toBeGreaterThan(65);

      // Query telemetry
      const retrieved = service.getBandwidthTelemetry(battleId) as any;
      expect(retrieved.battleId).toBe(battleId);
      expect(retrieved.totalEvents).toBe(2);
    });

    it('lists all active battle telemetry records', () => {
      service.recordBandwidth('battle-1', 'keystroke', 100, 30, true);
      service.recordBandwidth('battle-2', 'cursor', 80, 20, true);

      const all = service.getBandwidthTelemetry() as any[];
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBe(2);
    });
  });

  describe('4. Performance Benchmark (< 0.1ms per frame)', () => {
    it('guarantees serialization and deserialization speeds under 0.1ms', () => {
      const envelope: BattleEventEnvelope = {
        version: 1,
        timestamp: Date.now(),
        eventType: 'keystroke',
        keystroke: {
          battleId: 'b-bench',
          userId: 'u-bench',
          sequence: 100,
          timestamp: Date.now(),
          cursorPosition: 50,
          deltaLength: 1,
          key: 'a',
          patchSnippet: 'a',
        },
      };

      const result = service.benchmarkFrameSpeed(envelope, 1000);
      expect(result.avgEncodeMs).toBeLessThan(0.1);
      expect(result.avgDecodeMs).toBeLessThan(0.1);
      expect(result.subPointOneMs).toBe(true);
      expect(result.savingsPercent).toBeGreaterThan(60);
    });
  });
});

