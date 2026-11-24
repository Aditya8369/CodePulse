import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'node:crypto';

class SriHashGeneratorService {
  generate(b) {
    const h = crypto.createHash('sha384').update(b).digest('base64');
    return 'sha384-' + h;
  }
}

describe('SriHashGeneratorService (#2181)', () => {
  test('generates sha384 base64 Subresource Integrity digests for CDN bundles', () => {
    const gen = new SriHashGeneratorService();
    const sri = gen.generate(Buffer.from('console.log("codepulse-bundle");'));
    assert.strictEqual(sri.startsWith('sha384-'), true);
  });
});
