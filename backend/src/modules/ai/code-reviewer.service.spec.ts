import { Test, TestingModule } from '@nestjs/testing';
import { CodeReviewerService } from './code-reviewer.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubService } from '../github/github.service';

describe('CodeReviewerService & Security Vulnerability Advisor Suite (#360)', () => {
  let service: CodeReviewerService;
  let mockPrisma: any;
  let mockGithub: any;

  beforeEach(async () => {
    mockPrisma = {
      codeReviewFinding: {
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'f-101', ...args.data })),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({ id: 'f-101', status: 'RESOLVED' }),
      },
    };

    mockGithub = {
      fetchCommitFiles: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeReviewerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GithubService, useValue: mockGithub },
      ],
    }).compile();

    service = module.get<CodeReviewerService>(CodeReviewerService);
  });

  describe('TypeScript / JavaScript AST Parsing & Function Scope Detection', () => {
    it('correctly associates findings with the enclosing function scope', () => {
      const code = `
        async function fetchUserProfile(userId: string) {
          const query = "SELECT * FROM users WHERE id = " + userId;
          return db.execute(query);
        }
      `;

      const findings = service.analyzeTypeScriptCode('src/users.ts', code);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].functionScope).toBe('fetchUserProfile');
      expect(findings[0].ruleId).toBe('OWASP-A03:SQL_INJECTION');
      expect(findings[0].severity).toBe('CRITICAL');
    });

    it('detects method scopes and arrow functions', () => {
      const code = `
        class AuthController {
          loginHandler = (token: string) => {
            const hash = crypto.createHash('md5').update(token).digest('hex');
            return hash;
          };
        }
      `;

      const findings = service.analyzeTypeScriptCode('src/auth.ts', code);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].functionScope).toBe('loginHandler');
      expect(findings[0].ruleId).toBe('OWASP-A02:INSECURE_CRYPTO');
      expect(findings[0].severity).toBe('HIGH');
    });
  });

  describe('OWASP Top 10 Security Vulnerability Detection', () => {
    it('1. Flags SQL Injection in template string interpolations and string concatenations', () => {
      const templateSql = `
        export const getOrders = (customerId: string) => {
          return db.query(\`SELECT * FROM orders WHERE customer_id = \${customerId}\`);
        };
      `;

      const findings = service.analyzeFile('src/orders.ts', templateSql);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('OWASP-A03:SQL_INJECTION');
      expect(findings[0].severity).toBe('CRITICAL');
      expect(findings[0].suggestedDiff).toContain('db.query');
    });

    it('2. Flags Cross-Site Scripting (XSS) via dangerouslySetInnerHTML and innerHTML', () => {
      const xssCode = `
        export function UserProfileCard({ bio }: { bio: string }) {
          return <div dangerouslySetInnerHTML={{ __html: bio }} />;
        }
      `;

      const findings = service.analyzeFile('src/UserProfile.tsx', xssCode);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('OWASP-A03:XSS');
      expect(findings[0].severity).toBe('HIGH');
      expect(findings[0].suggestedDiff).toContain('DOMPurify.sanitize');
    });

    it('3. Flags Insecure Cryptographic Algorithms (MD5 & SHA1)', () => {
      const md5Code = `
        import crypto from 'crypto';
        export function hashPassword(password: string) {
          return crypto.createHash('md5').update(password).digest('hex');
        }
      `;

      const findings = service.analyzeFile('src/crypto.ts', md5Code);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('OWASP-A02:INSECURE_CRYPTO');
      expect(findings[0].suggestedDiff).toContain("crypto.createHash('sha256')");
    });

    it('4. Flags Hardcoded Credentials and API Keys', () => {
      const secretCode = `
        const AWS_SECRET_KEY = "AKIA1234567890ABCDEF";
        const GITHUB_API_TOKEN = "ghp_1234567890abcdef1234567890abcdef12";
      `;

      const findings = service.analyzeFile('src/config.ts', secretCode);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0].ruleId).toBe('OWASP-A07:HARDCODED_SECRET');
      expect(findings[0].severity).toBe('CRITICAL');
      expect(findings[0].suggestedDiff).toContain('process.env');
    });

    it('5. Flags Regular Expression Denial of Service (ReDoS) with catastrophic backtracking', () => {
      const redosCode = `
        const emailValidator = /([a-zA-Z0-9_]+)+@domain.com/;
      `;

      const findings = service.analyzeFile('src/validators.ts', redosCode);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('OWASP-A01:REDOS');
      expect(findings[0].severity).toBe('MEDIUM');
    });

    it('6. Flags Command Injection in child_process.exec calls', () => {
      const cmdCode = `
        import { exec } from 'child_process';
        function pingHost(host: string) {
          exec('ping -c 1 ' + host);
        }
      `;

      const findings = service.analyzeFile('src/network.ts', cmdCode);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('OWASP-A03:CMD_INJECTION');
      expect(findings[0].severity).toBe('CRITICAL');
      expect(findings[0].suggestedDiff).toContain('execFile');
    });
  });

  describe('Python Static Security Analysis', () => {
    it('flags Python SQL injection in f-strings and cursor.execute', () => {
      const pyCode = `
def get_user_account(user_id):
    cursor.execute(f"SELECT * FROM accounts WHERE id = {user_id}")
    return cursor.fetchone()
      `;

      const findings = service.analyzeFile('services/account.py', pyCode);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].ruleId).toBe('OWASP-A03:SQL_INJECTION');
      expect(findings[0].functionScope).toBe('get_user_account');
      expect(findings[0].severity).toBe('CRITICAL');
    });

    it('flags Python insecure crypto (hashlib.md5)', () => {
      const pyCode = `
import hashlib
def make_token(raw_string):
    return hashlib.md5(raw_string.encode()).hexdigest()
      `;

      const findings = service.analyzeFile('services/crypto.py', pyCode);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].ruleId).toBe('OWASP-A02:INSECURE_CRYPTO');
      expect(findings[0].suggestedDiff).toContain('hashlib.sha256');
    });

    it('flags Python hardcoded secret keys', () => {
      const pyCode = `
SECRET_KEY = "super_secret_jwt_signing_key_12345"
API_KEY = "my_private_service_token_xyz"
      `;

      const findings = service.analyzeFile('settings.py', pyCode);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0].ruleId).toBe('OWASP-A07:HARDCODED_SECRET');
      expect(findings[0].suggestedDiff).toContain('os.environ.get');
    });
  });

  describe('Clean Code & High Performance Verification', () => {
    it('yields 0 findings for clean, secure code adhering to security best practices', () => {
      const secureCode = `
        import crypto from 'crypto';
        export async function secureUserLookup(userId: string) {
          const token = crypto.createHash('sha256').update(userId).digest('hex');
          const sql = 'SELECT id, email FROM users WHERE id = $1';
          return db.query(sql, [userId]);
        }
      `;

      const findings = service.analyzeFile('src/secure.ts', secureCode);
      expect(findings).toHaveLength(0);
    });

    it('executes analysis in < 3s per file satisfying response time acceptance criterion', async () => {
      const largeFile = `
        function processBatch(items: any[]) {
          return items.map((x) => x * 2);
        }
      `.repeat(50);

      const startTime = performance.now();
      const summary = await service.reviewCommit({
        commitSha: 'c-speed-test-12345678901234567890',
        files: [{ filePath: 'src/batch.ts', content: largeFile }],
      });
      const elapsedMs = performance.now() - startTime;

      // Acceptance criterion: < 3s (3000ms)
      expect(elapsedMs).toBeLessThan(1000);
      expect(summary.scannedFilesCount).toBe(1);
    });
  });

  describe('Commit Review & Repository Dashboard Summary Generation', () => {
    it('produces formatted markdown dashboard report with severity counts and diffs', async () => {
      const vulnerableFile = `
        function queryUser(id: string) {
          db.query("SELECT * FROM users WHERE id = " + id);
        }
        const API_KEY = "AIzaSyD-123456789012345678";
      `;

      const summary = await service.reviewCommit({
        commitSha: 'a1b2c3d4e5f6',
        repository: 'code-with-abhi-i5/CodePulse',
        files: [{ filePath: 'src/api.ts', content: vulnerableFile }],
      });

      expect(summary.commitSha).toBe('a1b2c3d4e5f6');
      expect(summary.findingsCount).toBe(2);
      expect(summary.criticalCount).toBe(2);
      expect(summary.dashboardSummaryMarkdown).toContain('AI Security & AST Code Review Summary');
      expect(summary.dashboardSummaryMarkdown).toContain('OWASP-A03:SQL_INJECTION');
      expect(summary.dashboardSummaryMarkdown).toContain('OWASP-A07:HARDCODED_SECRET');
      expect(summary.dashboardSummaryMarkdown).toContain('Recommended Fixes');
    });

    it('allows updating resolution status of a finding', async () => {
      const res = await service.updateFindingStatus('f-101', 'RESOLVED');
      expect(res).toBe(true);
      expect(mockPrisma.codeReviewFinding.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'f-101' },
          data: { status: 'RESOLVED' },
        }),
      );
    });
  });
});
