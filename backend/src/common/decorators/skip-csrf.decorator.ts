import { SetMetadata } from '@nestjs/common';

export const SKIP_CSRF_KEY = 'skipCsrf';

/**
 * Decorator to exempt specific endpoints or controllers from CSRF token verification.
 */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);

