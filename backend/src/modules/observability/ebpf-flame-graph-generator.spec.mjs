import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class EbpfFlameGraphGeneratorService {
  collapse(samples) {
    return samples.map(s => `${s.frames.join(';')} ${s.count}`).join('\n');
  }
}

describe('EbpfFlameGraphGeneratorService (#2227)', () => {
  test('formats kernel stack samples into standard collapsed flame graph syntax', () => {
    const gen = new EbpfFlameGraphGeneratorService();
    const out = gen.collapse([{ frames: ['main', 'read', 'sys_read'], count: 42 }]);
    assert.strictEqual(out, 'main;read;sys_read 42');
  });
});
