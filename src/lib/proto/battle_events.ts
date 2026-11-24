/**
 * Battle Events Protocol Buffers v3 Binary Codec
 * Generated TypeScript bindings and high-speed binary serialization engine.
 * Supports KeystrokeDelta, CursorPosition, TestResult, and MatchStatus.
 */

export enum KeystrokeType {
  KEYSTROKE_TYPE_UNSPECIFIED = 0,
  KEYSTROKE_TYPE_INSERT = 1,
  KEYSTROKE_TYPE_DELETE = 2,
  KEYSTROKE_TYPE_CURSOR_MOVE = 3,
  KEYSTROKE_TYPE_REPLACE = 4,
}

export enum MatchStatusState {
  MATCH_STATUS_UNSPECIFIED = 0,
  MATCH_STATUS_WAITING = 1,
  MATCH_STATUS_STARTING = 2,
  MATCH_STATUS_IN_PROGRESS = 3,
  MATCH_STATUS_PAUSED = 4,
  MATCH_STATUS_COMPLETED = 5,
  MATCH_STATUS_SUDDEN_DEATH = 6,
  MATCH_STATUS_CANCELLED = 7,
}

export interface KeystrokeDelta {
  battleId: string;
  userId: string;
  sequence: number;
  timestamp: number;
  cursorPosition?: number;
  deltaLength?: number;
  keystrokeType?: KeystrokeType;
  key?: string;
  patchSnippet?: string;
  isTypoCorrection?: boolean;
}

export interface CursorPosition {
  battleId: string;
  userId: string;
  lineNumber: number;
  column: number;
  selectionStartLine?: number;
  selectionStartColumn?: number;
  selectionEndLine?: number;
  selectionEndColumn?: number;
  timestamp: number;
}

export interface TestResult {
  battleId: string;
  userId: string;
  testCaseId: string;
  passed: boolean;
  durationMs: number;
  actualOutput?: string;
  expectedOutput?: string;
  errorMessage?: string;
  memoryKb?: number;
  timestamp: number;
}

export interface MatchStatus {
  battleId: string;
  status: MatchStatusState;
  winnerId?: string;
  timeRemainingMs?: number;
  scores?: Record<string, number>;
  roundNumber?: number;
  timestamp: number;
}

export interface BattleEventEnvelope {
  version: number;
  timestamp: number;
  eventType: 'keystroke' | 'cursor' | 'test_result' | 'match_status';
  keystroke?: KeystrokeDelta;
  cursor?: CursorPosition;
  testResult?: TestResult;
  matchStatus?: MatchStatus;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

class BinaryWriter {
  private chunks: Uint8Array[] = [];
  private totalLength = 0;

  writeTag(fieldNumber: number, wireType: number): void {
    const tag = (fieldNumber << 3) | wireType;
    this.writeVarint(tag);
  }

  writeVarint(value: number | bigint): void {
    let val = typeof value === 'bigint' ? value : BigInt(Math.floor(value));
    if (val < BigInt(0)) {
      // 64-bit two's complement for negative numbers
      val = BigInt(value) & BigInt('0xffffffffffffffff');
    }
    const bytes: number[] = [];
    const big0x80 = BigInt(0x80);
    const big0x7f = BigInt(0x7f);
    const big7 = BigInt(7);
    while (val >= big0x80) {
      bytes.push(Number(val & big0x7f) | 0x80);
      val >>= big7;
    }
    bytes.push(Number(val));
    const arr = new Uint8Array(bytes);
    this.chunks.push(arr);
    this.totalLength += arr.length;
  }

  writeString(fieldNumber: number, str?: string): void {
    if (!str) return;
    this.writeTag(fieldNumber, 2);
    const encoded = textEncoder.encode(str);
    this.writeVarint(encoded.length);
    this.chunks.push(encoded);
    this.totalLength += encoded.length;
  }

  writeBool(fieldNumber: number, val?: boolean): void {
    if (val === undefined || val === false) return;
    this.writeTag(fieldNumber, 0);
    this.writeVarint(1);
  }

  writeInt32(fieldNumber: number, val?: number): void {
    if (val === undefined || val === 0) return;
    this.writeTag(fieldNumber, 0);
    this.writeVarint(val);
  }

  writeInt64(fieldNumber: number, val?: number | bigint): void {
    if (val === undefined || val === 0 || (typeof val === 'bigint' && val === BigInt(0))) return;
    this.writeTag(fieldNumber, 0);
    this.writeVarint(val);
  }

  writeFloat64(fieldNumber: number, val?: number): void {
    if (val === undefined || val === 0) return;
    this.writeTag(fieldNumber, 1);
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setFloat64(0, val, true); // Little endian
    const arr = new Uint8Array(buffer);
    this.chunks.push(arr);
    this.totalLength += 8;
  }

  writeBytes(fieldNumber: number, bytes: Uint8Array): void {
    if (!bytes || bytes.length === 0) return;
    this.writeTag(fieldNumber, 2);
    this.writeVarint(bytes.length);
    this.chunks.push(bytes);
    this.totalLength += bytes.length;
  }

  toUint8Array(): Uint8Array {
    const result = new Uint8Array(this.totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
}

class BinaryReader {
  private view: Uint8Array;
  private offset = 0;

  constructor(buffer: Uint8Array | ArrayBuffer) {
    this.view = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  }

  hasMore(): boolean {
    return this.offset < this.view.length;
  }

  readTag(): { fieldNumber: number; wireType: number } {
    const tag = this.readVarint();
    return {
      fieldNumber: tag >> 3,
      wireType: tag & 0x07,
    };
  }

  readVarint(): number {
    let result = 0;
    let shift = 0;
    while (this.offset < this.view.length) {
      const byte = this.view[this.offset++];
      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    return result;
  }

  readVarint64(): number {
    let result = BigInt(0);
    let shift = BigInt(0);
    const big0x7f = BigInt(0x7f);
    const big0x80 = BigInt(0x80);
    const big0 = BigInt(0);
    const big7 = BigInt(7);
    while (this.offset < this.view.length) {
      const byte = BigInt(this.view[this.offset++]);
      result |= (byte & big0x7f) << shift;
      if ((byte & big0x80) === big0) break;
      shift += big7;
    }
    return Number(result);
  }

  readString(): string {
    const length = this.readVarint();
    const slice = this.view.subarray(this.offset, this.offset + length);
    this.offset += length;
    return textDecoder.decode(slice);
  }

  readFloat64(): number {
    const view = new DataView(this.view.buffer, this.view.byteOffset + this.offset, 8);
    const val = view.getFloat64(0, true);
    this.offset += 8;
    return val;
  }

  readBytes(): Uint8Array {
    const length = this.readVarint();
    const slice = this.view.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  skip(wireType: number): void {
    if (wireType === 0) {
      this.readVarint();
    } else if (wireType === 1) {
      this.offset += 8;
    } else if (wireType === 2) {
      const length = this.readVarint();
      this.offset += length;
    } else if (wireType === 5) {
      this.offset += 4;
    }
  }
}

// ======================== CODECS ========================

export function encodeKeystrokeDelta(msg: KeystrokeDelta): Uint8Array {
  const w = new BinaryWriter();
  w.writeString(1, msg.battleId);
  w.writeString(2, msg.userId);
  w.writeInt32(3, msg.sequence);
  w.writeInt64(4, msg.timestamp);
  w.writeInt32(5, msg.cursorPosition);
  w.writeInt32(6, msg.deltaLength);
  w.writeInt32(7, msg.keystrokeType);
  w.writeString(8, msg.key);
  w.writeString(9, msg.patchSnippet);
  w.writeBool(10, msg.isTypoCorrection);
  return w.toUint8Array();
}

export function decodeKeystrokeDelta(buf: Uint8Array | ArrayBuffer): KeystrokeDelta {
  const r = new BinaryReader(buf);
  const msg: KeystrokeDelta = {
    battleId: '',
    userId: '',
    sequence: 0,
    timestamp: 0,
    isTypoCorrection: false,
  };

  while (r.hasMore()) {
    const { fieldNumber, wireType } = r.readTag();
    switch (fieldNumber) {
      case 1: msg.battleId = r.readString(); break;
      case 2: msg.userId = r.readString(); break;
      case 3: msg.sequence = r.readVarint(); break;
      case 4: msg.timestamp = r.readVarint64(); break;
      case 5: msg.cursorPosition = r.readVarint(); break;
      case 6: msg.deltaLength = r.readVarint(); break;
      case 7: msg.keystrokeType = r.readVarint() as KeystrokeType; break;
      case 8: msg.key = r.readString(); break;
      case 9: msg.patchSnippet = r.readString(); break;
      case 10: msg.isTypoCorrection = r.readVarint() !== 0; break;
      default: r.skip(wireType); break;
    }
  }
  return msg;
}

export function encodeCursorPosition(msg: CursorPosition): Uint8Array {
  const w = new BinaryWriter();
  w.writeString(1, msg.battleId);
  w.writeString(2, msg.userId);
  w.writeInt32(3, msg.lineNumber);
  w.writeInt32(4, msg.column);
  w.writeInt32(5, msg.selectionStartLine);
  w.writeInt32(6, msg.selectionStartColumn);
  w.writeInt32(7, msg.selectionEndLine);
  w.writeInt32(8, msg.selectionEndColumn);
  w.writeInt64(9, msg.timestamp);
  return w.toUint8Array();
}

export function decodeCursorPosition(buf: Uint8Array | ArrayBuffer): CursorPosition {
  const r = new BinaryReader(buf);
  const msg: CursorPosition = {
    battleId: '',
    userId: '',
    lineNumber: 1,
    column: 1,
    timestamp: 0,
  };

  while (r.hasMore()) {
    const { fieldNumber, wireType } = r.readTag();
    switch (fieldNumber) {
      case 1: msg.battleId = r.readString(); break;
      case 2: msg.userId = r.readString(); break;
      case 3: msg.lineNumber = r.readVarint(); break;
      case 4: msg.column = r.readVarint(); break;
      case 5: msg.selectionStartLine = r.readVarint(); break;
      case 6: msg.selectionStartColumn = r.readVarint(); break;
      case 7: msg.selectionEndLine = r.readVarint(); break;
      case 8: msg.selectionEndColumn = r.readVarint(); break;
      case 9: msg.timestamp = r.readVarint64(); break;
      default: r.skip(wireType); break;
    }
  }
  return msg;
}

export function encodeTestResult(msg: TestResult): Uint8Array {
  const w = new BinaryWriter();
  w.writeString(1, msg.battleId);
  w.writeString(2, msg.userId);
  w.writeString(3, msg.testCaseId);
  w.writeBool(4, msg.passed);
  w.writeFloat64(5, msg.durationMs);
  w.writeString(6, msg.actualOutput);
  w.writeString(7, msg.expectedOutput);
  w.writeString(8, msg.errorMessage);
  w.writeInt32(9, msg.memoryKb);
  w.writeInt64(10, msg.timestamp);
  return w.toUint8Array();
}

export function decodeTestResult(buf: Uint8Array | ArrayBuffer): TestResult {
  const r = new BinaryReader(buf);
  const msg: TestResult = {
    battleId: '',
    userId: '',
    testCaseId: '',
    passed: false,
    durationMs: 0,
    timestamp: 0,
  };

  while (r.hasMore()) {
    const { fieldNumber, wireType } = r.readTag();
    switch (fieldNumber) {
      case 1: msg.battleId = r.readString(); break;
      case 2: msg.userId = r.readString(); break;
      case 3: msg.testCaseId = r.readString(); break;
      case 4: msg.passed = r.readVarint() !== 0; break;
      case 5: msg.durationMs = r.readFloat64(); break;
      case 6: msg.actualOutput = r.readString(); break;
      case 7: msg.expectedOutput = r.readString(); break;
      case 8: msg.errorMessage = r.readString(); break;
      case 9: msg.memoryKb = r.readVarint(); break;
      case 10: msg.timestamp = r.readVarint64(); break;
      default: r.skip(wireType); break;
    }
  }
  return msg;
}

export function encodeMatchStatus(msg: MatchStatus): Uint8Array {
  const w = new BinaryWriter();
  w.writeString(1, msg.battleId);
  w.writeInt32(2, msg.status);
  w.writeString(3, msg.winnerId);
  w.writeInt64(4, msg.timeRemainingMs);
  
  // scores map entry: field 5 repeated message { 1: key, 2: value }
  if (msg.scores) {
    for (const [key, val] of Object.entries(msg.scores)) {
      const entryWriter = new BinaryWriter();
      entryWriter.writeString(1, key);
      entryWriter.writeInt32(2, val);
      w.writeBytes(5, entryWriter.toUint8Array());
    }
  }

  w.writeInt32(6, msg.roundNumber);
  w.writeInt64(7, msg.timestamp);
  return w.toUint8Array();
}

export function decodeMatchStatus(buf: Uint8Array | ArrayBuffer): MatchStatus {
  const r = new BinaryReader(buf);
  const msg: MatchStatus = {
    battleId: '',
    status: MatchStatusState.MATCH_STATUS_UNSPECIFIED,
    timestamp: 0,
  };

  while (r.hasMore()) {
    const { fieldNumber, wireType } = r.readTag();
    switch (fieldNumber) {
      case 1: msg.battleId = r.readString(); break;
      case 2: msg.status = r.readVarint() as MatchStatusState; break;
      case 3: msg.winnerId = r.readString(); break;
      case 4: msg.timeRemainingMs = r.readVarint64(); break;
      case 5: {
        const entryBytes = r.readBytes();
        const entryReader = new BinaryReader(entryBytes);
        let key = '';
        let val = 0;
        while (entryReader.hasMore()) {
          const entryTag = entryReader.readTag();
          if (entryTag.fieldNumber === 1) key = entryReader.readString();
          else if (entryTag.fieldNumber === 2) val = entryReader.readVarint();
          else entryReader.skip(entryTag.wireType);
        }
        if (!msg.scores) msg.scores = {};
        msg.scores[key] = val;
        break;
      }
      case 6: msg.roundNumber = r.readVarint(); break;
      case 7: msg.timestamp = r.readVarint64(); break;
      default: r.skip(wireType); break;
    }
  }
  return msg;
}

export function encodeBattleEvent(env: BattleEventEnvelope): Uint8Array {
  const w = new BinaryWriter();
  w.writeInt32(1, env.version || 1);
  w.writeInt64(2, env.timestamp || Date.now());

  if (env.keystroke) {
    w.writeBytes(4, encodeKeystrokeDelta(env.keystroke));
  } else if (env.cursor) {
    w.writeBytes(5, encodeCursorPosition(env.cursor));
  } else if (env.testResult) {
    w.writeBytes(6, encodeTestResult(env.testResult));
  } else if (env.matchStatus) {
    w.writeBytes(7, encodeMatchStatus(env.matchStatus));
  } else if (env.eventType) {
    w.writeString(3, env.eventType);
  }

  return w.toUint8Array();
}

export function decodeBattleEvent(buf: Uint8Array | ArrayBuffer): BattleEventEnvelope {
  const r = new BinaryReader(buf);
  const env: BattleEventEnvelope = {
    version: 1,
    timestamp: 0,
    eventType: 'keystroke',
  };

  while (r.hasMore()) {
    const { fieldNumber, wireType } = r.readTag();
    switch (fieldNumber) {
      case 1: env.version = r.readVarint(); break;
      case 2: env.timestamp = r.readVarint64(); break;
      case 3: env.eventType = r.readString() as any; break;
      case 4:
        env.eventType = 'keystroke';
        env.keystroke = decodeKeystrokeDelta(r.readBytes());
        break;
      case 5:
        env.eventType = 'cursor';
        env.cursor = decodeCursorPosition(r.readBytes());
        break;
      case 6:
        env.eventType = 'test_result';
        env.testResult = decodeTestResult(r.readBytes());
        break;
      case 7:
        env.eventType = 'match_status';
        env.matchStatus = decodeMatchStatus(r.readBytes());
        break;
      default:
        r.skip(wireType);
        break;
    }
  }

  return env;
}
