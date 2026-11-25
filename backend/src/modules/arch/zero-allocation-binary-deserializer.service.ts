import { Injectable, Logger } from '@nestjs/common';

export interface DecodedRpcPacket {
  commandId: number;
  payloadLength: number;
  payloadSlice: Buffer;
}

@Injectable()
export class ZeroAllocationBinaryDeserializerService {
  private readonly logger = new Logger(ZeroAllocationBinaryDeserializerService.name);

  public deserializePacket(buffer: Buffer, offset: number = 0): DecodedRpcPacket {
    // Binary layout: [2 bytes commandId][4 bytes payloadLength][payload bytes]
    if (buffer.length < offset + 6) {
      throw new Error('BUFFER_UNDERFLOW');
    }

    const commandId = buffer.readUInt16BE(offset);
    const payloadLength = buffer.readUInt32BE(offset + 2);

    if (buffer.length < offset + 6 + payloadLength) {
      throw new Error('INCOMPLETE_PAYLOAD');
    }

    // Zero-allocation subarray reference
    const payloadSlice = buffer.subarray(offset + 6, offset + 6 + payloadLength);

    return {
      commandId,
      payloadLength,
      payloadSlice
    };
  }
}
