export class BinaryWebSocketProtoService {
  public encodeFrame(typeId: number, payload: string): Buffer {
    const payloadBuf = Buffer.from(payload, 'utf8');
    const headerBuf = Buffer.alloc(4);
    headerBuf.writeUInt16BE(typeId, 0);
    headerBuf.writeUInt16BE(payloadBuf.length, 2);
    return Buffer.concat([headerBuf, payloadBuf]);
  }

  public decodeFrame(buffer: Buffer): { typeId: number; payload: string } {
    if (buffer.length < 4) throw new Error('Frame too short');
    const typeId = buffer.readUInt16BE(0);
    const length = buffer.readUInt16BE(2);
    const payload = buffer.toString('utf8', 4, 4 + length);
    return { typeId, payload };
  }
}
