import { Test, TestingModule } from '@nestjs/testing';
import { PiiRedactorService } from './pii-redactor.service';
import { LoggerService } from './logger.service';
import { SanitizeLoggingInterceptor } from '../interceptors/sanitize-logging.interceptor';
import { of } from 'rxjs';

describe('PiiRedactorService & Sensitive Token Redaction Pipeline', () => {
  let redactor: PiiRedactorService;
  let logger: LoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PiiRedactorService, LoggerService],
    }).compile();

    redactor = module.get<PiiRedactorService>(PiiRedactorService);
    logger = module.get<LoggerService>(LoggerService);
  });

  describe('30 Sensitive Token & PII Format Redactions', () => {
    const testCases: { name: string; input: string; tag: string; originalToken: string }[] = [
      // 1-5: GitHub Tokens
      {
        name: 'GitHub Classic Personal Access Token (ghp)',
        input: 'Developer used token ghp_111122223333444455556666777788889999 in auth header',
        tag: 'ghp',
        originalToken: 'ghp_111122223333444455556666777788889999',
      },
      {
        name: 'GitHub Fine-Grained Personal Access Token (github_pat)',
        input: 'Key: github_pat_11A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0_T1U2V3W4X5Y6Z7A8B9C0D1',
        tag: 'ghp',
        originalToken: 'github_pat_11A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0_T1U2V3W4X5Y6Z7A8B9C0D1',
      },
      {
        name: 'GitHub OAuth Access Token (gho)',
        input: 'Exchanging code for token gho_16C7e42F292c6912E7710c838347Ae178B4a for user',
        tag: 'ghp',
        originalToken: 'gho_16C7e42F292c6912E7710c838347Ae178B4a',
      },
      {
        name: 'GitHub User-to-Server Token (ghu)',
        input: 'Session established with ghu_16C7e42F292c6912E7710c838347Ae178B4a',
        tag: 'ghp',
        originalToken: 'ghu_16C7e42F292c6912E7710c838347Ae178B4a',
      },
      {
        name: 'GitHub Server-to-Server Token (ghs)',
        input: 'App installation bearer: ghs_16C7e42F292c6912E7710c838347Ae178B4a',
        tag: 'ghp',
        originalToken: 'ghs_16C7e42F292c6912E7710c838347Ae178B4a',
      },

      // 6-8: AWS Access Keys & Secrets
      {
        name: 'AWS Access Key ID (AKIA)',
        input: 'Uploading artifact with credentials AKIAIOSFODNN7EXAMPLE to S3',
        tag: 'aws_key',
        originalToken: 'AKIAIOSFODNN7EXAMPLE',
      },
      {
        name: 'AWS Access Key ID (ASIA)',
        input: 'Session token key ASIAIOSFODNN7EXAMPLE refreshed',
        tag: 'aws_key',
        originalToken: 'ASIAIOSFODNN7EXAMPLE',
      },
      {
        name: 'AWS Secret Access Key',
        input: 'aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"',
        tag: 'aws_secret',
        originalToken: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      },

      // 9-11: Private Keys
      {
        name: 'RSA Private Key',
        input: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0Y1lM5...\n-----END RSA PRIVATE KEY-----',
        tag: 'private_key',
        originalToken: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0Y1lM5...\n-----END RSA PRIVATE KEY-----',
      },
      {
        name: 'Generic Private Key',
        input: '-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg...\n-----END PRIVATE KEY-----',
        tag: 'private_key',
        originalToken: '-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg...\n-----END PRIVATE KEY-----',
      },
      {
        name: 'PGP Private Key Block',
        input: '-----BEGIN PGP PRIVATE KEY BLOCK-----\nVersion: BCPG C# v1.6.1.0\n\nlQOYBF25...\n-----END PGP PRIVATE KEY BLOCK-----',
        tag: 'pgp_key',
        originalToken: '-----BEGIN PGP PRIVATE KEY BLOCK-----\nVersion: BCPG C# v1.6.1.0\n\nlQOYBF25...\n-----END PGP PRIVATE KEY BLOCK-----',
      },

      // 12-14: JWT and Bearer Tokens
      {
        name: 'JSON Web Token (JWT)',
        input: 'User session eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c expired',
        tag: 'jwt',
        originalToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      },
      {
        name: 'Authorization Bearer Token',
        input: 'Headers: Authorization: Bearer secret_bearer_token_xyz_1234567890',
        tag: 'bearer',
        originalToken: 'secret_bearer_token_xyz_1234567890',
      },
      {
        name: 'Generic API Key attribute',
        input: 'api_key: "abc123def456ghi789jkl012mno345pqr"',
        tag: 'api_key',
        originalToken: 'abc123def456ghi789jkl012mno345pqr',
      },

      // 15-18: SaaS Tokens (Slack, Stripe, OpenAI, Google) - dummy patterns for testing
      {
        name: 'Slack Bot Token (xoxb)',
        input: 'Notification posted via ' + ['xoxb', '000000000000', '0000000000000', 'mockdummysecrettoken012345'].join('-'),
        tag: 'slack_token',
        originalToken: ['xoxb', '000000000000', '0000000000000', 'mockdummysecrettoken012345'].join('-'),
      },
      {
        name: 'Slack User Token (xoxp)',
        input: 'Webhook listener ' + ['xoxp', '000000000000', '0000000000000', 'mockdummysecrettoken012345'].join('-') + ' active',
        tag: 'slack_token',
        originalToken: ['xoxp', '000000000000', '0000000000000', 'mockdummysecrettoken012345'].join('-'),
      },
      {
        name: 'Stripe Live Secret Key (sk_live)',
        input: 'Payment intent created ' + ['sk', 'live', '00000000000000000000000000000000'].join('_'),
        tag: 'stripe_key',
        originalToken: ['sk', 'live', '00000000000000000000000000000000'].join('_'),
      },
      {
        name: 'Stripe Test Secret Key (sk_test)',
        input: 'Testing checkout with ' + ['sk', 'test', '00000000000000000000000000000000'].join('_'),
        tag: 'stripe_key',
        originalToken: ['sk', 'test', '00000000000000000000000000000000'].join('_'),
      },
      {
        name: 'OpenAI API Key (sk-...)',
        input: 'LLM invoked with sk-abcdefghijklmnopqrstuvwxyz123456789012',
        tag: 'openai_key',
        originalToken: 'sk-abcdefghijklmnopqrstuvwxyz123456789012',
      },
      {
        name: 'Google API Key (AIza...)',
        input: 'Map tile requested using AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q',
        tag: 'google_key',
        originalToken: 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q',
      },

      // 21-24: Passwords & Credentials
      {
        name: 'JSON Password field',
        input: '{"user": "alice", "password": "SuperSecretPassword123!"}',
        tag: 'password',
        originalToken: 'SuperSecretPassword123!',
      },
      {
        name: 'JSON Client Secret field',
        input: '{"client_id": "app-1", "client_secret": "my-client-super-secret-key"}',
        tag: 'password',
        originalToken: 'my-client-super-secret-key',
      },
      {
        name: 'PostgreSQL URI with password',
        input: 'Connecting to postgres://admin:TopSecretDbPass123@db.prod.internal:5432/codepulse',
        tag: 'db_uri',
        originalToken: 'TopSecretDbPass123',
      },
      {
        name: 'MongoDB URI with password',
        input: 'Cluster URI mongodb+srv://clusterUser:MongoPass987@cluster0.mongodb.net/test',
        tag: 'db_uri',
        originalToken: 'MongoPass987',
      },

      // 25-28: Credit Cards & SSN
      {
        name: 'Visa Credit Card (hyphenated)',
        input: 'Billing card charged: 4532-1234-5678-9010',
        tag: 'credit_card',
        originalToken: '4532-1234-5678-9010',
      },
      {
        name: 'MasterCard Credit Card (spaces)',
        input: 'Billing card charged: 5412 7512 3412 3456',
        tag: 'credit_card',
        originalToken: '5412 7512 3412 3456',
      },
      {
        name: 'American Express Credit Card',
        input: 'Corporate card: 378282246310005',
        tag: 'credit_card',
        originalToken: '378282246310005',
      },
      {
        name: 'US Social Security Number (SSN)',
        input: 'Identity verification for SSN 123-45-6789 submitted',
        tag: 'ssn',
        originalToken: '123-45-6789',
      },

      // 29-30: Email addresses
      {
        name: 'Corporate Email Address',
        input: 'Contact developer at pratik.giri@codepulse.io for access',
        tag: 'email',
        originalToken: 'pratik.giri@codepulse.io',
      },
      {
        name: 'Personal Gmail Address',
        input: 'Notification dispatched to player.one@gmail.com successfully',
        tag: 'email',
        originalToken: 'player.one@gmail.com',
      },
    ];

    testCases.forEach((tc, idx) => {
      it(`[Format #${idx + 1}] should detect and redact ${tc.name}`, () => {
        const result = redactor.redactString(tc.input);
        expect(result.redactedText).not.toContain(tc.originalToken);
        expect(result.redactedText).toMatch(new RegExp(`\\[REDACTED:${tc.tag}:[a-f0-9]{8}\\]`));
        expect(result.redactedCount).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Salted Hash Determinism & Log Correlation', () => {
    it('produces deterministic hashes for the same secret with the same salt', () => {
      const secret = 'ghp_sameTokenAcrossMultipleLogs1234567890';
      const hash1 = redactor.generateHash(secret);
      const hash2 = redactor.generateHash(secret);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(8);
    });

    it('produces different hashes for different secrets', () => {
      const hashA = redactor.generateHash('ghp_tokenA123456789012345678901234567890');
      const hashB = redactor.generateHash('ghp_tokenB123456789012345678901234567890');
      expect(hashA).not.toBe(hashB);
    });
  });

  describe('Performance Benchmark (< 0.1ms per log statement)', () => {
    it('adds under 0.1ms overhead per average log statement', () => {
      const logStatement =
        'User pratik@codepulse.io with AKIAIOSFODNN7EXAMPLE invoked API using token ghp_111122223333444455556666777788889999 at 2026-11-19';

      // Warm-up run
      for (let i = 0; i < 50; i++) {
        redactor.redactString(logStatement);
      }

      const iterations = 500;
      const start = process.hrtime.bigint();
      for (let i = 0; i < iterations; i++) {
        redactor.redactString(logStatement);
      }
      const end = process.hrtime.bigint();

      const totalTimeMs = Number(end - start) / 1_000_000;
      const avgTimeMs = totalTimeMs / iterations;

      expect(avgTimeMs).toBeLessThan(0.1); // < 0.1ms requirement
    });
  });

  describe('Object & Error Stack Redaction', () => {
    it('deeply sanitizes nested objects and objects with credential keys', () => {
      const obj = {
        user: {
          email: 'admin@codepulse.io',
          credentials: {
            password: 'SuperSecretPassword!',
            aws: {
              accessKey: 'AKIAIOSFODNN7EXAMPLE',
            },
          },
        },
      };

      const sanitized = redactor.redactObject(obj);
      expect(sanitized.user.email).not.toContain('admin@codepulse.io');
      expect(sanitized.user.credentials.password).not.toContain('SuperSecretPassword!');
      expect(sanitized.user.credentials.aws.accessKey).not.toContain('AKIAIOSFODNN7EXAMPLE');
    });

    it('redacts secrets inside Error messages and Error stacks', () => {
      const error = new Error('Database connect failed with password SuperSecretPassword! at ghp_111122223333444455556666777788889999');
      const sanitizedErr = redactor.redactObject(error);
      expect(sanitizedErr.message).not.toContain('SuperSecretPassword!');
      expect(sanitizedErr.message).not.toContain('ghp_111122223333444455556666777788889999');
      if (sanitizedErr.stack) {
        expect(sanitizedErr.stack).not.toContain('SuperSecretPassword!');
      }
    });
  });

  describe('LoggerService Integration', () => {
    it('formats log entries with redacted messages and metadata', () => {
      const formatted = logger.formatLog('error', 'Failed API call with key AKIAIOSFODNN7EXAMPLE', [
        { email: 'dev@codepulse.io' },
      ]);

      expect(formatted.message).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(formatted.message).toContain('[REDACTED:aws_key:');
      expect(formatted.sanitized).toBe(true);
      expect(JSON.stringify(formatted.metadata)).not.toContain('dev@codepulse.io');
    });
  });

  describe('SanitizeLoggingInterceptor', () => {
    it('intercepts HTTP requests and sanitizes body and response stream', async () => {
      const interceptor = new SanitizeLoggingInterceptor(redactor, logger);

      const mockExecutionContext = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'POST',
            url: '/api/v1/users',
            headers: { authorization: 'Bearer secret_token_xyz_1234567890' },
            body: { email: 'test@codepulse.io', password: 'Secret12345!' },
          }),
          getResponse: () => ({
            statusCode: 200,
          }),
        }),
      } as any;

      const mockCallHandler = {
        handle: () => of({ success: true, email: 'test@codepulse.io', userToken: 'ghp_111122223333444455556666777788889999' }),
      };

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);
      result$.subscribe((res) => {
        expect(res.email).not.toContain('test@codepulse.io');
        expect(res.userToken).not.toContain('ghp_111122223333444455556666777788889999');
        expect(res.userToken).toContain('[REDACTED:ghp:');
      });
    });
  });
});
