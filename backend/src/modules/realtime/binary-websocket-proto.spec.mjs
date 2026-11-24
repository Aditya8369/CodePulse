import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class BinaryWebSocketProtoService {
  encodeFrame(type, payload) {
    const p = Buffer.from(payload, 'utf8');
    const h = Buffer.alloc(4);
    h.writeUInt16BE(type, 0);
    h.writeUInt16BE(p.length, 2);
    return Buffer.concat([h, p]);
  }
  decodeFrame(buf) {
    const type = buf.readUInt16BE(0);
    const len = buf.readUInt16BE(2);
    return { typeId: type, payload: buf.toString('utf8', 4, 4 + len) };
  }
}

describe('BinaryWebSocketProtoService (Issue #1921)', () => {
  it('should encode and decode binary framed WebSocket payloads', () => {
    const proto = new BinaryWebSocketProtoService();
    const frame = proto.encodeFrame(101, '{"op":"cursor_move","x":50,"y":120}');
    const decoded = proto.decodeFrame(frame);

    assert.equal(decoded.typeId, 101);
    assert.equal(decoded.payload, '{"op":"cursor_move","x":50,"y":120}');
  });
});
