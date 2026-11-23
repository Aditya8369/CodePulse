import { SetMetadata, CustomDecorator } from '@nestjs/common';

export const IDEMPOTENT_METADATA_KEY = 'IDEMPOTENT_METADATA_KEY';

export interface IdempotentOptions {
  lifetimeSeconds?: number; // TTL in seconds (default: 120s)
  enforceHeader?: boolean; // Whether Idempotency-Key header is strictly required (default: true)
}

/**
 * Decorator to enforce RFC 9457 idempotency key checks and mutation deduplication.
 */
export const Idempotent = (options: IdempotentOptions = {}): CustomDecorator<string> =>
  SetMetadata(IDEMPOTENT_METADATA_KEY, {
    lifetimeSeconds: options.lifetimeSeconds ?? 120,
    enforceHeader: options.enforceHeader ?? true,
  });
