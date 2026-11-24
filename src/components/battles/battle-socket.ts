/**
 * BattleSocketClient: High-Performance Binary Protocol WebSocket Streaming
 *
 * Implements Protocol Buffers binary streaming over WebSockets with automatic
 * negotiation (application/x-protobuf), fallback to JSON, and direct Monaco Editor
 * cursor decorator updates.
 */

import { io, Socket } from 'socket.io-client';
import {
  BattleEventEnvelope,
  CursorPosition,
  KeystrokeDelta,
  MatchStatus,
  TestResult,
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
} from '@/lib/proto/battle_events';

export interface ClientBandwidthStats {
  battleId: string;
  totalPacketsReceived: number;
  totalPacketsSent: number;
  binaryBytesReceived: number;
  binaryBytesSent: number;
  jsonEquivalentBytes: number;
  actualBytesTransferred: number;
  savedBytes: number;
  savedPercentage: number;
  negotiatedEncoding: 'binary' | 'json';
}

export interface BattleSocketOptions {
  apiUrl?: string;
  battleId: string;
  userId: string;
  preferBinary?: boolean;
  onKeystroke?: (keystroke: KeystrokeDelta) => void;
  onCursor?: (cursor: CursorPosition) => void;
  onTestResult?: (testResult: TestResult) => void;
  onMatchStatus?: (matchStatus: MatchStatus) => void;
  onBandwidthUpdate?: (stats: ClientBandwidthStats) => void;
}

export class BattleSocketClient {
  private socket: Socket | null = null;
  private readonly options: BattleSocketOptions;
  private negotiatedEncoding: 'binary' | 'json' = 'json';
  private previousDecorations: string[] = [];

  // Client telemetry metrics
  private bandwidthStats: ClientBandwidthStats;

  constructor(options: BattleSocketOptions) {
    this.options = {
      preferBinary: true,
      ...options,
    };

    this.bandwidthStats = {
      battleId: this.options.battleId,
      totalPacketsReceived: 0,
      totalPacketsSent: 0,
      binaryBytesReceived: 0,
      binaryBytesSent: 0,
      jsonEquivalentBytes: 0,
      actualBytesTransferred: 0,
      savedBytes: 0,
      savedPercentage: 0,
      negotiatedEncoding: this.options.preferBinary ? 'binary' : 'json',
    };
  }

  /**
   * Connects to the Battle WebSocket gateway with binary negotiation headers.
   */
  public connect(): Socket {
    const baseUrl = this.options.apiUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const socketUrl = `${new URL(baseUrl, typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin).origin}/battles`;

    const extraHeaders: Record<string, string> = {};
    if (this.options.preferBinary) {
      extraHeaders['Accept'] = 'application/x-protobuf';
      extraHeaders['Content-Type'] = 'application/x-protobuf';
    }

    this.socket = io(socketUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 5000,
      query: {
        battleId: this.options.battleId,
        userId: this.options.userId,
        encoding: this.options.preferBinary ? 'protobuf' : 'json',
      },
      extraHeaders,
    });

    this.socket.on('connect', () => {
      this.socket?.emit('battle:join', {
        battleId: this.options.battleId,
        userId: this.options.userId,
      });
    });

    // Listen for server protocol negotiation confirmation
    this.socket.on('battle:encoding_negotiated', (data: { encoding: 'binary' | 'json'; contentType: string }) => {
      this.negotiatedEncoding = data.encoding;
      this.bandwidthStats.negotiatedEncoding = data.encoding;
      this.notifyBandwidthUpdate();
    });

    // Handle incoming binary events (Envelope format)
    this.socket.on('battle:event_binary', (arrayBuffer: ArrayBuffer) => {
      this.handleIncomingBinary(arrayBuffer);
    });

    // Handle specialized binary streams
    this.socket.on('battle:keystroke_binary', (arrayBuffer: ArrayBuffer) => {
      try {
        const keystroke = decodeKeystrokeDelta(arrayBuffer);
        this.trackPacketStats(arrayBuffer.byteLength, JSON.stringify(keystroke).length, true);
        this.options.onKeystroke?.(keystroke);
      } catch {
        // Fallback or ignore malformed
      }
    });

    this.socket.on('battle:cursor_binary', (arrayBuffer: ArrayBuffer) => {
      try {
        const cursor = decodeCursorPosition(arrayBuffer);
        this.trackPacketStats(arrayBuffer.byteLength, JSON.stringify(cursor).length, true);
        this.options.onCursor?.(cursor);
      } catch {
        // Fallback or ignore malformed
      }
    });

    // JSON fallbacks for backward compatibility
    this.socket.on('opponent_keystroke_stream', (data: any) => {
      const jsonLen = JSON.stringify(data).length;
      this.trackPacketStats(jsonLen, jsonLen, false);
      this.options.onKeystroke?.({
        battleId: data.battleId,
        userId: data.userId,
        sequence: data.sequence || 0,
        timestamp: data.timestamp || Date.now(),
        cursorPosition: data.cursorPosition,
        deltaLength: data.deltaLength,
      });
    });

    this.socket.on('battle:cursor_stream', (data: any) => {
      const jsonLen = JSON.stringify(data).length;
      this.trackPacketStats(jsonLen, jsonLen, false);
      this.options.onCursor?.(data);
    });

    return this.socket;
  }

  /**
   * Directly deserializes incoming binary ArrayBuffer and dispatches typed event.
   */
  public handleIncomingBinary(buffer: ArrayBuffer | Uint8Array): BattleEventEnvelope | null {
    try {
      const envelope = decodeBattleEvent(buffer);
      const binaryLen = buffer instanceof ArrayBuffer ? buffer.byteLength : buffer.length;
      const jsonLen = JSON.stringify(envelope).length;
      this.trackPacketStats(binaryLen, jsonLen, true);

      if (envelope.keystroke) {
        this.options.onKeystroke?.(envelope.keystroke);
      } else if (envelope.cursor) {
        this.options.onCursor?.(envelope.cursor);
      } else if (envelope.testResult) {
        this.options.onTestResult?.(envelope.testResult);
      } else if (envelope.matchStatus) {
        this.options.onMatchStatus?.(envelope.matchStatus);
      }

      return envelope;
    } catch {
      return null;
    }
  }

  /**
   * Sends rapid keystroke delta over binary or JSON protocol.
   */
  public sendKeystroke(delta: Partial<KeystrokeDelta>): void {
    if (!this.socket) return;

    const fullPayload: KeystrokeDelta = {
      battleId: this.options.battleId,
      userId: this.options.userId,
      sequence: delta.sequence || 0,
      timestamp: delta.timestamp || Date.now(),
      cursorPosition: delta.cursorPosition,
      deltaLength: delta.deltaLength,
      keystrokeType: delta.keystrokeType,
      key: delta.key,
      patchSnippet: delta.patchSnippet,
      isTypoCorrection: delta.isTypoCorrection,
    };

    if (this.negotiatedEncoding === 'binary') {
      const binary = encodeKeystrokeDelta(fullPayload);
      const jsonBytes = JSON.stringify(fullPayload).length;
      this.trackSentStats(binary.byteLength, jsonBytes, true);
      this.socket.emit('battle:binary_event', binary.buffer);
    } else {
      const jsonBytes = JSON.stringify(fullPayload).length;
      this.trackSentStats(jsonBytes, jsonBytes, false);
      this.socket.emit('keystroke', {
        battleId: this.options.battleId,
        userId: this.options.userId,
        delta: fullPayload.patchSnippet || '',
        cursorPosition: fullPayload.cursorPosition,
        key: fullPayload.key,
      });
    }
  }

  /**
   * Sends cursor position with sub-millisecond serialization.
   */
  public sendCursor(cursor: Partial<CursorPosition>): void {
    if (!this.socket) return;

    const fullCursor: CursorPosition = {
      battleId: this.options.battleId,
      userId: this.options.userId,
      lineNumber: cursor.lineNumber || 1,
      column: cursor.column || 1,
      selectionStartLine: cursor.selectionStartLine,
      selectionStartColumn: cursor.selectionStartColumn,
      selectionEndLine: cursor.selectionEndLine,
      selectionEndColumn: cursor.selectionEndColumn,
      timestamp: cursor.timestamp || Date.now(),
    };

    if (this.negotiatedEncoding === 'binary') {
      const binary = encodeCursorPosition(fullCursor);
      const jsonBytes = JSON.stringify(fullCursor).length;
      this.trackSentStats(binary.byteLength, jsonBytes, true);
      this.socket.emit('battle:cursor_move', binary.buffer);
    } else {
      const jsonBytes = JSON.stringify(fullCursor).length;
      this.trackSentStats(jsonBytes, jsonBytes, false);
      this.socket.emit('battle:cursor_move', fullCursor);
    }
  }

  /**
   * Sends test result evaluation.
   */
  public sendTestResult(result: Partial<TestResult>): void {
    if (!this.socket) return;

    const fullResult: TestResult = {
      battleId: this.options.battleId,
      userId: this.options.userId,
      testCaseId: result.testCaseId || 'tc-1',
      passed: Boolean(result.passed),
      durationMs: result.durationMs || 0,
      actualOutput: result.actualOutput,
      expectedOutput: result.expectedOutput,
      errorMessage: result.errorMessage,
      memoryKb: result.memoryKb,
      timestamp: result.timestamp || Date.now(),
    };

    if (this.negotiatedEncoding === 'binary') {
      const envelope: BattleEventEnvelope = {
        version: 1,
        timestamp: Date.now(),
        eventType: 'test_result',
        testResult: fullResult,
      };
      const binary = encodeBattleEvent(envelope);
      const jsonBytes = JSON.stringify(envelope).length;
      this.trackSentStats(binary.byteLength, jsonBytes, true);
      this.socket.emit('battle:binary_event', binary.buffer);
    } else {
      const jsonBytes = JSON.stringify(fullResult).length;
      this.trackSentStats(jsonBytes, jsonBytes, false);
      this.socket.emit('test_case_eval', {
        battleId: this.options.battleId,
        userId: this.options.userId,
        passedCount: fullResult.passed ? 1 : 0,
        totalCount: 1,
        executionTimeMs: fullResult.durationMs,
      });
    }
  }

  /**
   * Directly updates Monaco Editor cursor decorators without overhead.
   */
  public applyCursorDecoration(editor: any, cursor: CursorPosition): string[] {
    if (!editor || typeof editor.deltaDecorations !== 'function') {
      return [];
    }

    const startLine = Math.max(1, cursor.lineNumber);
    const startCol = Math.max(1, cursor.column);
    const endLine = Math.max(startLine, cursor.selectionEndLine || startLine);
    const endCol = Math.max(startCol, cursor.selectionEndColumn || startCol);

    const newDecorations = [
      {
        range: {
          startLineNumber: startLine,
          startColumn: startCol,
          endLineNumber: endLine,
          endColumn: endCol,
        },
        options: {
          className: 'opponent-cursor-decoration animate-pulse',
          hoverMessage: { value: `**Opponent Cursor**: Line ${startLine}, Col ${startCol}` },
          glyphMarginClassName: 'opponent-cursor-glyph',
          overviewRuler: {
            color: 'rgba(239, 68, 68, 0.8)',
            position: 1,
          },
        },
      },
    ];

    this.previousDecorations = editor.deltaDecorations(this.previousDecorations, newDecorations);
    return this.previousDecorations;
  }

  /**
   * Tracks telemetry metrics on received packets.
   */
  private trackPacketStats(actualBytes: number, jsonEquivalent: number, isBinary: boolean): void {
    this.bandwidthStats.totalPacketsReceived++;
    this.bandwidthStats.actualBytesTransferred += actualBytes;
    this.bandwidthStats.jsonEquivalentBytes += jsonEquivalent;
    if (isBinary) {
      this.bandwidthStats.binaryBytesReceived += actualBytes;
    }

    this.updateSavingsMetrics();
  }

  /**
   * Tracks telemetry metrics on sent packets.
   */
  private trackSentStats(actualBytes: number, jsonEquivalent: number, isBinary: boolean): void {
    this.bandwidthStats.totalPacketsSent++;
    this.bandwidthStats.actualBytesTransferred += actualBytes;
    this.bandwidthStats.jsonEquivalentBytes += jsonEquivalent;
    if (isBinary) {
      this.bandwidthStats.binaryBytesSent += actualBytes;
    }

    this.updateSavingsMetrics();
  }

  private updateSavingsMetrics(): void {
    this.bandwidthStats.savedBytes = Math.max(
      0,
      this.bandwidthStats.jsonEquivalentBytes - this.bandwidthStats.actualBytesTransferred,
    );
    this.bandwidthStats.savedPercentage =
      this.bandwidthStats.jsonEquivalentBytes > 0
        ? Number(((this.bandwidthStats.savedBytes / this.bandwidthStats.jsonEquivalentBytes) * 100).toFixed(2))
        : 0;

    this.notifyBandwidthUpdate();
  }

  private notifyBandwidthUpdate(): void {
    this.options.onBandwidthUpdate?.({ ...this.bandwidthStats });
  }

  public getBandwidthStats(): ClientBandwidthStats {
    return { ...this.bandwidthStats };
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Codec benchmark validator: validates sub-0.1ms serialization speed and > 65% size reduction.
   */
  public static benchmark(iterations = 1000): {
    avgEncodeMs: number;
    avgDecodeMs: number;
    jsonBytes: number;
    binaryBytes: number;
    savingsPercentage: number;
    passedAcceptance: boolean;
  } {
    const sampleEnvelope: BattleEventEnvelope = {
      version: 1,
      timestamp: 1700000000000,
      eventType: 'keystroke',
      keystroke: {
        battleId: 'battle-nsoc-531',
        userId: 'dev-master-01',
        sequence: 42,
        timestamp: 1700000000000,
        cursorPosition: 128,
        deltaLength: 4,
        key: 'f',
        patchSnippet: 'func',
        isTypoCorrection: false,
      },
    };

    // Warmup
    for (let i = 0; i < 50; i++) {
      const b = encodeBattleEvent(sampleEnvelope);
      decodeBattleEvent(b);
    }

    const t0 = performance.now();
    let bin: Uint8Array = new Uint8Array(0);
    for (let i = 0; i < iterations; i++) {
      bin = encodeBattleEvent(sampleEnvelope);
    }
    const t1 = performance.now();
    const avgEncodeMs = (t1 - t0) / iterations;

    const t2 = performance.now();
    for (let i = 0; i < iterations; i++) {
      decodeBattleEvent(bin);
    }
    const t3 = performance.now();
    const avgDecodeMs = (t3 - t2) / iterations;

    const jsonBytes = JSON.stringify(sampleEnvelope).length;
    const binaryBytes = bin.byteLength;
    const savingsPercentage = Number((((jsonBytes - binaryBytes) / jsonBytes) * 100).toFixed(2));

    return {
      avgEncodeMs,
      avgDecodeMs,
      jsonBytes,
      binaryBytes,
      savingsPercentage,
      passedAcceptance: avgEncodeMs < 0.1 && avgDecodeMs < 0.1 && savingsPercentage >= 65,
    };
  }
}

