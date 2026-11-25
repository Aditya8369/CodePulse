import { describe, it } from 'node:test';
import assert from 'node:assert';
import { StaticAssetEdgeRouterService } from './arch-svc-65.service.ts';

describe('StaticAssetEdgeRouterService (ARCH-SVC-65)', () => {
  it('resolves asset URLs to nearest regional CDN edge endpoints', () => {
    const router = new StaticAssetEdgeRouterService();
    router.registerEdge('default', 'cdn.codepulse.io');
    router.registerEdge('in', 'in-cdn.codepulse.io');
    router.registerEdge('us', 'us-cdn.codepulse.io');

    assert.strictEqual(router.resolveAssetUrl('in', 'images/logo.png'), 'https://in-cdn.codepulse.io/images/logo.png');
    assert.strictEqual(router.resolveAssetUrl('br', 'images/logo.png'), 'https://cdn.codepulse.io/images/logo.png');
  });
});
