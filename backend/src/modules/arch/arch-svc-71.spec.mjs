import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ApiDeprecationHeaderInjectorService } from './arch-svc-71.service.ts';

describe('ApiDeprecationHeaderInjectorService (ARCH-SVC-71)', () => {
  it('injects standard IETF Deprecation, Sunset, and Link headers for deprecated routes', () => {
    const injector = new ApiDeprecationHeaderInjectorService();
    injector.registerDeprecation(new RegExp('^/api/v1/challenges'), '2027-01-01T00:00:00Z', 'https://api.codepulse.io/docs/v2-migration');

    const headers = injector.injectHeaders('/api/v1/challenges/123', {});
    assert.ok(headers['Deprecation']);
    assert.strictEqual(headers['Sunset'], 'Fri, 01 Jan 2027 00:00:00 GMT');
    assert.strictEqual(headers['Link'], '<https://api.codepulse.io/docs/v2-migration>; rel="sunset"');

    // Untouched route
    const okHeaders = injector.injectHeaders('/api/v2/challenges', {});
    assert.strictEqual(okHeaders['Deprecation'], undefined);
  });
});
