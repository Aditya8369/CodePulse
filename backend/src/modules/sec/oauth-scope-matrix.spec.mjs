import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class OAuthScopeMatrixMiddleware {
  constructor() {
    this.grants = { SPA: ['authorization_code'], SERVICE: ['client_credentials'] };
  }
  validateGrantType(type, grant) {
    const allowed = this.grants[type];
    return allowed ? allowed.includes(grant) : false;
  }
  hasRequiredScopes(tokenScopes, requiredScopes) {
    const set = new Set(tokenScopes);
    return requiredScopes.every(s => set.has(s));
  }
}

describe('OAuthScopeMatrixMiddleware (Issue #1862)', () => {
  it('should enforce strict OAuth 2.1 grant type checks and scope authorization', () => {
    const middleware = new OAuthScopeMatrixMiddleware();
    assert.equal(middleware.validateGrantType('SPA', 'authorization_code'), true);
    assert.equal(middleware.validateGrantType('SPA', 'client_credentials'), false);

    assert.equal(middleware.hasRequiredScopes(['read:submissions', 'write:code'], ['read:submissions']), true);
    assert.equal(middleware.hasRequiredScopes(['read:submissions'], ['read:submissions', 'admin:all']), false);
  });
});
