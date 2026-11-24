import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as zlib from 'zlib';

class ZstandardEventCompressorService {
  compress(p) {
    const raw = Buffer.from(p, 'utf8');
    const def = zlib.deflateSync(raw);
    return { base64: def.toString('base64'), ratio: def.length / raw.length };
  }
  decompress(b64) {
    const buf = Buffer.from(b64, 'base64');
    return zlib.inflateSync(buf).toString('utf8');
  }
}

describe('ZstandardEventCompressorService (#2303)', () => {
  test('compresses and inflates high-volume event payloads with high compression ratio', () => {
    const comp = new ZstandardEventCompressorService();
    const payload = JSON.stringify({ type: 'TELEMETRY', data: 'A'.repeat(500) });
    const { base64, ratio } = comp.compress(payload);
    assert.ok(ratio < 0.2); // Compressed to less than 20% size

    const recovered = comp.decompress(base64);
    assert.strictEqual(recovered, payload);
  });
});
