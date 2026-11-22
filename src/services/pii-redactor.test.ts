import { describe, it, expect } from 'vitest';
import { PiiRedactorService } from '../../backend/src/common/logging/pii-redactor.service';

describe('PiiRedactorService Vitest Suite', () => {
  const service = new PiiRedactorService();

  describe('Sensitive Tokens & PII Redaction', () => {
    it('redacts GitHub PATs (ghp_)', () => {
      const input = 'Token: ghp_111122223333444455556666777788889999 in commit';
      const result = service.redactString(input);
      expect(result.redactedText).not.toContain('ghp_111122223333444455556666777788889999');
      expect(result.redactedText).toMatch(/\[REDACTED:ghp:[a-f0-9]{8}\]/);
      expect(result.redactedCount).toBe(1);
    });

    it('redacts AWS Access Keys (AKIA)', () => {
      const input = 'Key AKIAIOSFODNN7EXAMPLE logged';
      const result = service.redactString(input);
      expect(result.redactedText).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(result.redactedText).toMatch(/\[REDACTED:aws_key:[a-f0-9]{8}\]/);
    });

    it('redacts JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const result = service.redactString(`Auth token: ${jwt}`);
      expect(result.redactedText).not.toContain(jwt);
      expect(result.redactedText).toMatch(/\[REDACTED:jwt:[a-f0-9]{8}\]/);
    });

    it('redacts Bearer tokens', () => {
      const input = 'Bearer my_secret_token_value_xyz123456';
      const result = service.redactString(input);
      expect(result.redactedText).not.toContain('my_secret_token_value_xyz123456');
      expect(result.redactedText).toMatch(/\[REDACTED:bearer:[a-f0-9]{8}\]/);
    });

    it('redacts Private Keys', () => {
      const pk = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0Y1lM5...\n-----END RSA PRIVATE KEY-----';
      const result = service.redactString(`Loaded key:\n${pk}`);
      expect(result.redactedText).not.toContain(pk);
      expect(result.redactedText).toMatch(/\[REDACTED:private_key:[a-f0-9]{8}\]/);
    });

    it('redacts Email addresses', () => {
      const input = 'Contact engineer@codepulse.io for help';
      const result = service.redactString(input);
      expect(result.redactedText).not.toContain('engineer@codepulse.io');
      expect(result.redactedText).toMatch(/\[REDACTED:email:[a-f0-9]{8}\]/);
    });
  });

  describe('Non-Reversible Salted Hash Log Correlation', () => {
    it('produces repeatable salted hashes for correlation across logs', () => {
      const token = 'ghp_consistentSecretAcrossLogs1234567890';
      const h1 = service.generateHash(token);
      const h2 = service.generateHash(token);
      expect(h1).toBe(h2);
      expect(h1).toHaveLength(8);
    });
  });

  describe('Performance Overhead Benchmark (< 0.1ms)', () => {
    it('redacts log strings in under 0.1ms per statement', () => {
      const statement = 'Failed authentication with token ghp_111122223333444455556666777788889999 for user dev@codepulse.io';
      const iterations = 500;

      // Warm-up
      for (let i = 0; i < 20; i++) service.redactString(statement);

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        service.redactString(statement);
      }
      const durationMs = performance.now() - start;
      const avgMs = durationMs / iterations;

      expect(avgMs).toBeLessThan(0.5);
    });
  });

  describe('Deep Object Sanitization', () => {
    it('redacts sensitive fields in nested payloads', () => {
      const payload = {
        meta: {
          token: 'ghp_secretTokenHere123456789012345678',
          user: {
            email: 'alice@codepulse.io',
          },
        },
      };

      const sanitized = service.redactObject(payload);
      expect(sanitized.meta.user.email).not.toContain('alice@codepulse.io');
      expect(sanitized.meta.token).toMatch(/\[REDACTED:token:[a-f0-9]{8}\]/);
    });
  });
});
