import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class VoiceOpusCompressorService {
  constructor() { this.threshold = 0.015; }
  process(p) {
    if (p.rms < this.threshold) return { forward: false, size: 0 };
    return { forward: true, size: Math.floor(p.len / 6) };
  }
}

describe('VoiceOpusCompressorService (#2118)', () => {
  test('suppresses silent audio packets and compresses speech frames', () => {
    const comp = new VoiceOpusCompressorService();
    const silent = comp.process({ rms: 0.005, len: 960 });
    assert.strictEqual(silent.forward, false);

    const speech = comp.process({ rms: 0.08, len: 960 });
    assert.strictEqual(speech.forward, true);
    assert.strictEqual(speech.size, 160);
  });
});
