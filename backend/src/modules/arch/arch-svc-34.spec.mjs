import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AdaptivePoolResizerService } from './arch-svc-34.service.ts';

describe('AdaptivePoolResizerService (ARCH-SVC-34)', () => {
  it('dynamically expands pool when saturation or queue depth climbs', () => {
    const resizer = new AdaptivePoolResizerService(5, 50, 10);
    const newCap = resizer.adjustPool(0.9, 15);
    assert.strictEqual(newCap, 12);
  });

  it('contracts pool during prolonged low saturation down to min limit', () => {
    const resizer = new AdaptivePoolResizerService(5, 50, 10);
    const contracted = resizer.adjustPool(0.1, 0);
    assert.strictEqual(contracted, 9);
  });
});
