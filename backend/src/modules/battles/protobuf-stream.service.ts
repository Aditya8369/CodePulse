import { Injectable, Logger } from '@nestjs/common';

export enum KeystrokeType {
  UNSPECIFIED = 0,
  INSERT = 1,
  DELETE = 2,
  CURSOR_MOVE = 3,
}

export interface BattleTelemetryFrame {
  battleId: string;
  userId: string;
  sequence: number;
  timestamp: number;
  cursorPosition: number;
  deltaLength: number;
  keystrokeType: KeystrokeType;
  key?: string;
  patchSnippet?: string;
}

@Injectable()
export class ProtobufStreamService {
  private readonly logger = new Logger(ProtobufStreamService.name);

  /**
   * Encodes a variable-length integer (Varint) per Protobuf specification.
   */
  public encodeVarint(val: number | bigint): Buffer {
    let value = typeof val === 'bigint' ? val : BigInt(val >>> 0);
    const bytes: number[] = [];

    while (value >= 0x80n) {
      bytes.push(Number(value & 0x7fn) | 0x80);
      value >>= 7n;
    }
    bytes.push(Number(value));

    return Buffer.from(bytes);
  }

  /**
   * Decodes a variable-length integer from buffer starting at offset.
   */
  public decodeVarint(buf: Buffer, offset: number): { value: number; bytesRead: number } {
    let result = 0;
    let shift = 0;
    let bytesRead = 0;

    while (offset + bytesRead < buf.length) {
      const byte = buf[offset + bytesRead];
      bytesRead++;
      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }

    return { value: result, bytesRead };
  }

  /**
   * Encodes BattleTelemetryFrame into compact Protobuf v3 binary format.
   * Field tags:
   * 1: battleId (string, wire type 2)
   * 2: userId (string, wire type 2)
   * 3: sequence (uint32, wire type 0)
   * 4: timestamp (uint64, wire type 0)
   * 5: cursorPosition (int32, wire type 0)
   * 6: deltaLength (int32, wire type 0)
   * 7: keystrokeType (enum, wire type 0)
   * 8: key (string, wire type 2)
   * 9: patchSnippet (string, wire type 2)
   */
  public encodeTelemetryFrame(frame: BattleTelemetryFrame): Buffer {
    const buffers: Buffer[] = [];

    // Tag helper: (fieldNumber << 3) | wireType
    const makeTag = (fieldNumber: number, wireType: number) => Buffer.from([(fieldNumber << 3) | wireType]);

    // 1: battleId
    if (frame.battleId) {
      const strBuf = Buffer.from(frame.battleId, 'utf8');
      buffers.push(makeTag(1, 2), this.encodeVarint(strBuf.length), strBuf);
    }

    // 2: userId
    if (frame.userId) {
      const strBuf = Buffer.from(frame.userId, 'utf8');
      buffers.push(makeTag(2, 2), this.encodeVarint(strBuf.length), strBuf);
    }

    // 3: sequence
    if (frame.sequence) {
      buffers.push(makeTag(3, 0), this.encodeVarint(frame.sequence));
    }

    // 4: timestamp
    if (frame.timestamp) {
      buffers.push(makeTag(4, 0), this.encodeVarint(frame.timestamp));
    }

    // 5: cursorPosition
    if (frame.cursorPosition) {
      buffers.push(makeTag(5, 0), this.encodeVarint(frame.cursorPosition));
    }

    // 6: deltaLength
    if (frame.deltaLength) {
      buffers.push(makeTag(6, 0), this.encodeVarint(frame.deltaLength));
    }

    // 7: keystrokeType
    if (frame.keystrokeType) {
      buffers.push(makeTag(7, 0), this.encodeVarint(frame.keystrokeType));
    }

    // 8: key
    if (frame.key) {
      const strBuf = Buffer.from(frame.key, 'utf8');
      buffers.push(makeTag(8, 2), this.encodeVarint(strBuf.length), strBuf);
    }

    // 9: patchSnippet
    if (frame.patchSnippet) {
      const strBuf = Buffer.from(frame.patchSnippet, 'utf8');
      buffers.push(makeTag(9, 2), this.encodeVarint(strBuf.length), strBuf);
    }

    return Buffer.concat(buffers);
  }

  /**
   * Decodes Protobuf v3 binary buffer into BattleTelemetryFrame.
   */
  public decodeTelemetryFrame(buf: Buffer): BattleTelemetryFrame {
    const frame: BattleTelemetryFrame = {
      battleId: '',
      userId: '',
      sequence: 0,
      timestamp: 0,
      cursorPosition: 0,
      deltaLength: 0,
      keystrokeType: KeystrokeType.UNSPECIFIED,
    };

    let offset = 0;
    while (offset < buf.length) {
      const tagByte = buf[offset++];
      const fieldNumber = tagByte >> 3;
      const wireType = tagByte & 0x07;

      if (wireType === 0) {
        // Varint
        const { value, bytesRead } = this.decodeVarint(buf, offset);
        offset += bytesRead;

        if (fieldNumber === 3) frame.sequence = value;
        else if (fieldNumber === 4) frame.timestamp = value;
        else if (fieldNumber === 5) frame.cursorPosition = value;
        else if (fieldNumber === 6) frame.deltaLength = value;
        else if (fieldNumber === 7) frame.keystrokeType = value;
      } else if (wireType === 2) {
        // Length-delimited string
        const { value: length, bytesRead } = this.decodeVarint(buf, offset);
        offset += bytesRead;
        const strVal = buf.toString('utf8', offset, offset + length);
        offset += length;

        if (fieldNumber === 1) frame.battleId = strVal;
        else if (fieldNumber === 2) frame.userId = strVal;
        else if (fieldNumber === 8) frame.key = strVal;
        else if (fieldNumber === 9) frame.patchSnippet = strVal;
      } else {
        // Skip unknown wire types
        offset++;
      }
    }

    return frame;
  }

  /**
   * Calculates bandwidth saving percentage between raw JSON and Protobuf binary
   */
  public measureBandwidthSaving(frame: BattleTelemetryFrame): {
    jsonBytes: number;
    protobufBytes: number;
    savedPercentage: number;
  } {
    const jsonBytes = Buffer.byteLength(JSON.stringify(frame), 'utf8');
    const protobufBytes = this.encodeTelemetryFrame(frame).length;
    const savedPercentage = Number((((jsonBytes - protobufBytes) / jsonBytes) * 100).toFixed(2));

    return { jsonBytes, protobufBytes, savedPercentage };
  }
}
