import { SetMetadata, CustomDecorator } from '@nestjs/common';

export const REQUIRE_SCOPE_KEY = 'api_key_scopes';

/**
 * Decorator to require one or more granular scopes for developer API keys.
 *
 * @example
 * @RequireScope('read:analytics')
 * @RequireScope('read:analytics', 'write:battles')
 */
export const RequireScope = (...scopes: string[]): CustomDecorator<string> =>
  SetMetadata(REQUIRE_SCOPE_KEY, scopes);

/**
 * Alias for RequireScope
 */
export const RequireScopes = (...scopes: string[]): CustomDecorator<string> =>
  SetMetadata(REQUIRE_SCOPE_KEY, scopes);

