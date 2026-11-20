import { describe, it, expect, vi } from 'vitest';
import { triggerCelebration } from './celebration';

describe('Celebration Utility Function', () => {
  it('triggers celebration gracefully without throwing in test environment', () => {
    expect(() => triggerCelebration()).not.toThrow();
  });
});
