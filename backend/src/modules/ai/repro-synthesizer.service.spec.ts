import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ReproSynthesizerService } from './repro-synthesizer.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReproSynthesizerService', () => {
  let service: ReproSynthesizerService;

  const sampleIssueBody = `
## Description
Whenever I submit the project creation form with unicode/emoji in the description, the backend crashes with 500.

## Steps to Reproduce
1. Log into the CodePulse dashboard
2. Navigate to /projects/new
3. Fill in title "Nexus Project" and description "Building next-gen AI 🚀🔥"
4. Click Submit button

## Expected Behavior
Project is created successfully and returns HTTP 201 Created with JSON payload.

## Actual Behavior
Server crashes with HTTP 500 Internal Server Error.
TypeError: Cannot read properties of undefined (reading 'sanitize')
    at ProjectService.createProject (/app/src/modules/projects/project.service.ts:42:18)
    at /app/node_modules/@nestjs/core/router/router-execution-context.js:46:28

## Environment
- OS: Ubuntu 22.04 LTS
- Node: v20.10.0
- Browser: Google Chrome 120

\`\`\`json
{
  "name": "Nexus Project",
  "description": "Building next-gen AI 🚀🔥"
}
\`\`\`

GET /api/v1/projects
POST /api/v1/projects
`;

  const samplePythonIssueBody = `
### Steps to Reproduce
1. Run python client with invalid token
2. Observe traceback

### Expected
401 Unauthorized response

### Actual
Traceback (most recent call last):
  File "client.py", line 12, in <module>
    client.authenticate()
KeyError: 'access_token'

### Environment
- Python: 3.11
- OS: macOS Sonoma
`;

  beforeEach(async () => {
    const mockPrisma = {
      issueRepro: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
        findUnique: jest.fn(),
      },
    };

    const mockConfig = {
      get: jest.fn().mockReturnValue('mock-github-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReproSynthesizerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<ReproSynthesizerService>(ReproSynthesizerService);
  });

  describe('Bug Report Parameters Extraction', () => {
    it('extracts steps to reproduce, expected and actual behavior', () => {
      const params = service.extractBugReportParameters(
        sampleIssueBody,
        'POST /api/v1/projects crashes with 500 on emoji description',
      );

      expect(params.stepsToReproduce.length).toBeGreaterThanOrEqual(3);
      expect(params.stepsToReproduce[0]).toContain('Log into the CodePulse dashboard');
      expect(params.expectedBehavior).toContain('201 Created');
      expect(params.actualBehavior).toContain('500 Internal Server Error');
      expect(params.inferredCategory).toBe('CRASH');
    });

    it('extracts environment specs, code snippets, and stack traces', () => {
      const params = service.extractBugReportParameters(sampleIssueBody);

      expect(params.environment['os']).toBe('Ubuntu 22.04 LTS');
      expect(params.environment['node']).toBe('v20.10.0');
      expect(params.codeSnippets.length).toBe(1);
      expect(params.codeSnippets[0].language).toBe('json');
      expect(params.stackTraces.length).toBeGreaterThan(0);
      expect(params.stackTraces[0]).toContain('TypeError');
    });

    it('extracts target endpoints from issue text', () => {
      const params = service.extractBugReportParameters(sampleIssueBody);

      expect(params.targetEndpoints.some((e) => e.path === '/api/v1/projects' && e.method === 'POST')).toBe(true);
      expect(params.targetEndpoints.some((e) => e.path === '/api/v1/projects' && e.method === 'GET')).toBe(true);
    });

    it('handles minimal/unstructured issue text gracefully', () => {
      const params = service.extractBugReportParameters('Invalid token on login refresh', 'Bug in Auth');

      expect(params.stepsToReproduce.length).toBeGreaterThan(0);
      expect(params.expectedBehavior).toBeDefined();
      expect(params.actualBehavior).toBeDefined();
      expect(params.inferredCategory).toBe('AUTH');
    });
  });

  describe('Language Detection & Few-Shot Prompts', () => {
    it('detects nodejs for web stack issues', () => {
      const params = service.extractBugReportParameters(sampleIssueBody);
      const lang = service.detectReproductionLanguage(params, 'auto');
      expect(lang).toBe('nodejs');
    });

    it('detects python when traceback or python environment is present', () => {
      const params = service.extractBugReportParameters(samplePythonIssueBody);
      const lang = service.detectReproductionLanguage(params, 'auto');
      expect(lang).toBe('python');
    });

    it('respects explicit requested language', () => {
      const params = service.extractBugReportParameters(sampleIssueBody);
      expect(service.detectReproductionLanguage(params, 'python')).toBe('python');
      expect(service.detectReproductionLanguage(params, 'bash')).toBe('curl');
      expect(service.detectReproductionLanguage(params, 'curl')).toBe('curl');
    });

    it('generates few-shot prompt for LLM synthesis', () => {
      const params = service.extractBugReportParameters(sampleIssueBody);
      const prompt = service.generateFewShotPrompt(params, 'nodejs', 'Test Title');

      expect(prompt).toContain('Target Language: nodejs');
      expect(prompt).toContain('Few-Shot Example');
      expect(prompt).toContain('Steps:');
    });
  });

  describe('Syntax Verification & Shell Escaping', () => {
    it('validates syntax of valid Node.js script', () => {
      const validJs = `
        const assert = require('assert');
        async function test() {
          const res = await fetch('http://localhost:3000');
          assert.strictEqual(res.status, 200);
        }
        test();
      `;
      const result = service.verifyScriptSyntax(validJs, 'nodejs');
      expect(result.valid).toBe(true);
    });

    it('detects syntax errors in invalid Node.js script', () => {
      const invalidJs = `async function bad() { const x = ; }`;
      const result = service.verifyScriptSyntax(invalidJs, 'nodejs');
      expect(result.valid).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('validates syntax of valid Python script and catches unclosed brackets', () => {
      const validPy = `
def repro():
    print("reproducing bug")
    if True:
        pass
`;
      expect(service.verifyScriptSyntax(validPy, 'python').valid).toBe(true);

      const invalidPy = `
def bad():
    items = [1, 2, (3, 4]
`;
      const invalidResult = service.verifyScriptSyntax(invalidPy, 'python');
      expect(invalidResult.valid).toBe(false);
    });

    it('safely escapes shell arguments and prevents injection', () => {
      const safe = service.escapeShellArg('simple');
      expect(safe).toBe("'simple'");

      const injection = service.escapeShellArg('foo; rm -rf /; echo "pwned"');
      expect(injection).toBe("'foo; rm -rf /; echo \"pwned\"'");

      const quoteEscape = service.escapeShellArg("user's test");
      expect(quoteEscape).toBe("'user'\\''s test'");
    });
  });

  describe('Docker Sandbox & Output Formatting', () => {
    it('generates Dockerfile and 1-click execution command', () => {
      const nodeSandbox = service.generateSandboxDockerfile('nodejs');
      expect(nodeSandbox.dockerfile).toContain('FROM node:20-alpine');
      expect(nodeSandbox.runCommand).toContain('docker run');
      expect(nodeSandbox.runCommand).toContain('node /app/repro.js');

      const pySandbox = service.generateSandboxDockerfile('python');
      expect(pySandbox.dockerfile).toContain('FROM python:3.11-slim');
      expect(pySandbox.runCommand).toContain('python /app/repro.py');
    });

    it('formats maintainer issue comment helper', () => {
      const comment = service.formatReproIssueComment({
        targetLanguage: 'nodejs',
        syntaxValid: true,
        confidenceScore: 0.95,
        scriptContent: 'console.log("hello");',
        dockerRunCommand: 'docker run --rm test',
        parameters: {
          stepsToReproduce: ['Do step A', 'Do step B'],
          expectedBehavior: 'Expect OK',
          actualBehavior: 'Got 500',
          environment: {},
          codeSnippets: [],
          stackTraces: [],
          targetEndpoints: [],
          inferredCategory: 'API',
        },
      });

      expect(comment).toContain('CodePulse Automated Bug Reproduction Synthesizer');
      expect(comment).toContain('✅ **Verified Valid**');
      expect(comment).toContain('1. Do step A');
      expect(comment).toContain('console.log("hello");');
      expect(comment).toContain('docker run --rm test');
    });
  });

  describe('End-to-End Synthesis Pipeline & Analytics Tracking', () => {
    it('synthesizes reproduction script end-to-end with high confidence', async () => {
      const result = await service.synthesizeReproductionScript({
        issueNumber: 369,
        issueTitle: 'POST /projects 500 error',
        issueBody: sampleIssueBody,
        repository: 'code-with-abhi-i5/CodePulse',
        targetLanguage: 'nodejs',
        postComment: false,
      });

      expect(result.id).toBeDefined();
      expect(result.targetLanguage).toBe('nodejs');
      expect(result.syntaxValid).toBe(true);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.9);
      expect(result.scriptContent).toContain('runBugReproduction');
      expect(result.dockerfileContent).toContain('node:20-alpine');
      expect(result.commentMarkdown).toContain('CodePulse Automated Bug Reproduction Synthesizer');
    });

    it('tracks reproduction execution results and calculates stats', async () => {
      const repro = await service.synthesizeReproductionScript({
        issueBody: 'Steps to reproduce:\n1. Click button\nExpected: ok\nActual: crash',
        repository: 'code-with-abhi-i5/CodePulse',
      });

      const updated = await service.trackExecutionResult(repro.id, {
        executionSuccess: true,
        executionOutput: '[BUG REPRODUCED] Confirmed server error: HTTP 500',
      });

      expect(updated.executionSuccess).toBe(true);

      const stats = await service.getReproStats('code-with-abhi-i5/CodePulse');
      expect(stats.totalSynthesized).toBeGreaterThan(0);
      expect(stats.syntaxValidRate).toBe(100);
      expect(stats.executionSuccessRate).toBe(100);
      expect(stats.languageDistribution['nodejs']).toBeGreaterThan(0);
    });

    it('synthesizes from webhook issue payload when bug is reported', async () => {
      const payload = {
        action: 'opened',
        issue: {
          number: 101,
          title: 'Critical Bug: Crash on startup',
          body: '1. Start server\nExpected: start\nActual: Error crash',
          labels: [{ name: 'bug' }],
        },
        repository: {
          full_name: 'code-with-abhi-i5/CodePulse',
        },
      };

      const result = await service.synthesizeFromWebhookIssue(payload);
      expect(result).not.toBeNull();
      expect(result?.issueNumber).toBe(101);
      expect(result?.syntaxValid).toBe(true);
    });

    it('ignores webhook payload when issue is not a bug', async () => {
      const payload = {
        action: 'opened',
        issue: {
          number: 102,
          title: 'Feature request: dark mode enhancement',
          body: 'Please add more themes',
          labels: [{ name: 'enhancement' }],
        },
        repository: {
          full_name: 'code-with-abhi-i5/CodePulse',
        },
      };

      const result = await service.synthesizeFromWebhookIssue(payload);
      expect(result).toBeNull();
    });
  });
});
