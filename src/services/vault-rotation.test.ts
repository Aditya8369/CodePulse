import { describe, it, expect, vi } from 'vitest';
import { ClientVaultRotationManager } from './vault-rotation';

describe('ClientVaultRotationManager', () => {
  it('validates active key and marks older keys invalid initially', () => {
    const manager = new ClientVaultRotationManager('key-prod-1');

    expect(manager.isKeyValid('key-prod-1')).toBe(true);
    expect(manager.isKeyValid('key-prod-old')).toBe(false);

    const status = manager.getStatus();
    expect(status.activeKeyId).toBe('key-prod-1');
    expect(status.previousKeyId).toBeNull();
    expect(status.isDualKeyActive).toBe(false);
  });

  it('maintains dual-key validation during 24-hour overlapping key transition', () => {
    const manager = new ClientVaultRotationManager('key-prod-1');
    const listener = vi.fn();
    manager.onRotation(listener);

    // Rotate to key-prod-2 with 24h window
    manager.handleKeyRotation('key-prod-2', 24 * 60 * 60 * 1000);

    expect(listener).toHaveBeenCalledTimes(1);

    // Both new key and previous key must be valid (Zero dropped user sessions)
    expect(manager.isKeyValid('key-prod-2')).toBe(true);
    expect(manager.isKeyValid('key-prod-1')).toBe(true);
    expect(manager.isKeyValid('key-unknown')).toBe(false);

    const status = manager.getStatus();
    expect(status.activeKeyId).toBe('key-prod-2');
    expect(status.previousKeyId).toBe('key-prod-1');
    expect(status.isDualKeyActive).toBe(true);
    expect(status.dualKeyWindowRemainingMs).toBeGreaterThan(0);
  });

  it('expires previous key verification after dual-key window elapses', () => {
    const manager = new ClientVaultRotationManager('key-initial');

    // Rotate with an already elapsed window (-1000ms)
    manager.handleKeyRotation('key-rotated', -1000);

    expect(manager.isKeyValid('key-rotated')).toBe(true);
    expect(manager.isKeyValid('key-initial')).toBe(false); // Expired!

    const status = manager.getStatus();
    expect(status.isDualKeyActive).toBe(false);
  });

  it('notifies listeners when Vault status switches to fallback mode', () => {
    const manager = new ClientVaultRotationManager('key-fallback-test');
    const listener = vi.fn();
    manager.onRotation(listener);

    manager.setVaultStatus('fallback');

    expect(listener).toHaveBeenCalled();
    expect(manager.getStatus().vaultStatus).toBe('fallback');
  });
});

