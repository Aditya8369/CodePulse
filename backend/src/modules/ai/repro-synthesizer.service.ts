import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ts from 'typescript';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BugReportParameters,
  CodeSnippetDto,
  ExtractBugParametersDto,
  ReproStatsDto,
  SynthesizeReproRequestDto,
  SynthesizedReproResponseDto,
  TargetEndpointDto,
  TrackReproExecutionDto,
} from './dto/repro-synthesizer.dto';

@Injectable()
export class ReproSynthesizerService {
  private readonly logger = new Logger(ReproSynthesizerService.name);

  // In-memory storage fallback for offline testing or environments without DB
  private readonly memoryRepros = new Map<string, SynthesizedReproResponseDto & { executionSuccess?: boolean; executionOutput?: string; errorLogs?: string }>();

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  /**
   * Safely escapes shell arguments by wrapping in single quotes and replacing internal quotes.
   */
  public escapeShellArg(arg: string): string {
    if (!arg) return "''";
    // Sanitize non-printable control characters except newline/tab
    const sanitized = arg.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    return `'${sanitized.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Extracts structured bug reproduction parameters from an unstructured issue description.
   */
  public extractBugReportParameters(
    issueBody: string,
    issueTitle?: string,
  ): BugReportParameters {
    const rawBody = issueBody || '';
    const title = issueTitle || '';

    // 1. Extract Code Snippets (fenced markdown code blocks)
    const codeSnippets: CodeSnippetDto[] = [];
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = codeBlockRegex.exec(rawBody)) !== null) {
      const language = (match[1] || 'plaintext').trim().toLowerCase();
      const code = match[2].trim();
      if (code.length > 0) {
        codeSnippets.push({ language, code });
      }
    }

    // 2. Extract Stack Traces
    const stackTraces: string[] = [];
    const stackTraceLines = rawBody.split(/\r?\n/);
    const traceCollector: string[] = [];
    let inTrace = false;

    for (const line of stackTraceLines) {
      const isTraceLine =
        /^\s*(at\s+[\w$./<>_-]+|\w*Error:|\w*Exception:|Traceback \(most recent call last\):|\s+File\s+"[^"]+",\s+line\s+\d+)/.test(
          line,
        );

      if (isTraceLine) {
        inTrace = true;
        traceCollector.push(line.trim());
      } else if (inTrace && line.trim() === '') {
        if (traceCollector.length > 0) {
          stackTraces.push(traceCollector.join('\n'));
          traceCollector.length = 0;
        }
        inTrace = false;
      }
    }
    if (traceCollector.length > 0) {
      stackTraces.push(traceCollector.join('\n'));
    }

    // 3. Extract Steps to Reproduce
    const stepsToReproduce: string[] = [];
    const stepsSectionRegex =
      /(?:##?\s*(?:Steps\s+to\s+Reproduce|How\s+to\s+reproduce|Reproduction\s+Steps|Steps|Reproduce))[:\s]*([\s\S]*?)(?=(?:##?\s+[A-Z]|\n\n[A-Z][a-zA-Z\s]{3,}:|$))/i;
    const stepsMatch = stepsSectionRegex.exec(rawBody);

    const stepsSource = stepsMatch ? stepsMatch[1] : rawBody;
    const stepLineRegex = /^\s*(?:\d+[.)]|\*|-|\[[ x]\])\s+(.+)$/gm;
    let stepLineMatch: RegExpExecArray | null;

    if (stepsMatch) {
      while ((stepLineMatch = stepLineRegex.exec(stepsSource)) !== null) {
        const step = stepLineMatch[1].trim();
        if (step.length > 2 && !/^(expected|actual|environment)/i.test(step)) {
          stepsToReproduce.push(step);
        }
      }
    } else {
      // Fallback: search for ordered list items 1. 2. 3. in whole body
      while ((stepLineMatch = stepLineRegex.exec(rawBody)) !== null) {
        const step = stepLineMatch[1].trim();
        if (step.length > 3 && !/^(expected|actual|env)/i.test(step)) {
          stepsToReproduce.push(step);
        }
      }
    }

    // If still empty, synthesize an actionable step from title
    if (stepsToReproduce.length === 0) {
      stepsToReproduce.push(
        title
          ? `Execute action described in title: ${title}`
          : 'Trigger system under reported conditions',
      );
    }

    // 4. Extract Expected Behavior
    let expectedBehavior = '';
    const expectedRegex =
      /(?:##?\s*(?:Expected\s+Behavior|Expected\s+Outcome|Expected|Should\s+be))[:\s]*([\s\S]*?)(?=(?:##?\s+[A-Z]|\n\n[A-Z][a-zA-Z\s]{3,}:|$))/i;
    const expectedMatch = expectedRegex.exec(rawBody);
    if (expectedMatch) {
      expectedBehavior = expectedMatch[1].trim();
    } else {
      expectedBehavior = 'System should process request and return successful HTTP 200/201 response.';
    }

    // 5. Extract Actual Behavior
    let actualBehavior = '';
    const actualRegex =
      /(?:##?\s*(?:Actual\s+Behavior|Actual\s+Outcome|Actual|Current\s+Behavior|Observed|Error))[:\s]*([\s\S]*?)(?=(?:##?\s+[A-Z]|\n\n[A-Z][a-zA-Z\s]{3,}:|$))/i;
    const actualMatch = actualRegex.exec(rawBody);
    if (actualMatch) {
      actualBehavior = actualMatch[1].trim();
    } else if (stackTraces.length > 0) {
      actualBehavior = stackTraces[0];
    } else {
      actualBehavior = 'Unexpected error occurred or assertion failed.';
    }

    // 6. Extract Environment Metadata
    const environment: Record<string, string> = {};
    const envSectionRegex =
      /(?:##?\s*(?:Environment|Context|System|Specs))[:\s]*([\s\S]*?)(?=(?:##?\s+[A-Z]|\n\n[A-Z][a-zA-Z\s]{3,}:|$))/i;
    const envMatch = envSectionRegex.exec(rawBody);
    const envSource = envMatch ? envMatch[1] : rawBody;

    const envLineRegex = /(?:^|\n)\s*[-*]?\s*([A-Za-z0-9_ -]+)[:=]\s*([^\n\r]+)/g;
    let envLineMatch: RegExpExecArray | null;
    while ((envLineMatch = envLineRegex.exec(envSource)) !== null) {
      const key = envLineMatch[1].trim().toLowerCase();
      const val = envLineMatch[2].trim();
      if (
        ['os', 'node', 'nodejs', 'npm', 'browser', 'version', 'platform', 'database', 'python', 'framework'].some(
          (k) => key.includes(k),
        )
      ) {
        environment[key] = val;
      }
    }

    // 7. Extract Target Endpoints / HTTP routes
    const targetEndpoints: TargetEndpointDto[] = [];
    const endpointRegex = /\b(GET|POST|PUT|PATCH|DELETE)\s+([/\w-~.%?&=]+)\b/gi;
    let epMatch: RegExpExecArray | null;
    while ((epMatch = endpointRegex.exec(rawBody)) !== null) {
      const method = epMatch[1].toUpperCase();
      const path = epMatch[2].startsWith('/') ? epMatch[2] : `/${epMatch[2]}`;
      if (!targetEndpoints.some((e) => e.method === method && e.path === path)) {
        targetEndpoints.push({ method, path });
      }
    }

    // Also look for URLs like http://localhost:3000/api/...
    const urlRegex = /(https?:\/\/[^\s'")]+)/g;
    let urlMatch: RegExpExecArray | null;
    while ((urlMatch = urlRegex.exec(rawBody)) !== null) {
      const fullUrl = urlMatch[1];
      try {
        const parsed = new URL(fullUrl);
        if (!targetEndpoints.some((e) => e.path === parsed.pathname)) {
          targetEndpoints.push({
            method: 'GET',
            path: parsed.pathname,
            url: fullUrl,
          });
        }
      } catch {
        // Ignore invalid URL
      }
    }

    // 8. Infer bug category
    let inferredCategory = 'GENERAL';
    const textLower = `${title} ${rawBody}`.toLowerCase();
    if (
      textLower.includes('auth') ||
      textLower.includes('401') ||
      textLower.includes('403') ||
      textLower.includes('jwt') ||
      textLower.includes('token') ||
      textLower.includes('login')
    ) {
      inferredCategory = 'AUTH';
    } else if (
      textLower.includes('500') ||
      textLower.includes('crash') ||
      textLower.includes('panic') ||
      textLower.includes('uncaught')
    ) {
      inferredCategory = 'CRASH';
    } else if (targetEndpoints.length > 0 || textLower.includes('api') || textLower.includes('endpoint')) {
      inferredCategory = 'API';
    } else if (textLower.includes('ui') || textLower.includes('css') || textLower.includes('button') || textLower.includes('render')) {
      inferredCategory = 'UI';
    } else if (textLower.includes('slow') || textLower.includes('timeout') || textLower.includes('memory') || textLower.includes('leak')) {
      inferredCategory = 'PERFORMANCE';
    }

    return {
      stepsToReproduce,
      expectedBehavior,
      actualBehavior,
      environment,
      codeSnippets,
      stackTraces,
      targetEndpoints,
      inferredCategory,
    };
  }

  /**
   * Automatically detects the optimal reproduction language if set to 'auto'.
   */
  public detectReproductionLanguage(
    params: BugReportParameters,
    requestedLanguage?: string,
  ): 'nodejs' | 'python' | 'curl' {
    if (requestedLanguage && requestedLanguage !== 'auto') {
      if (requestedLanguage === 'bash') return 'curl';
      return requestedLanguage as 'nodejs' | 'python' | 'curl';
    }

    const allSnippets = params.codeSnippets.map((s) => s.language).join(' ');
    const allText = `${params.expectedBehavior} ${params.actualBehavior} ${JSON.stringify(params.environment)}`.toLowerCase();

    if (
      allSnippets.includes('python') ||
      allSnippets.includes('py') ||
      allText.includes('python') ||
      allText.includes('pip') ||
      allText.includes('django') ||
      allText.includes('flask') ||
      allText.includes('traceback (most recent call last)')
    ) {
      return 'python';
    }

    if (
      params.targetEndpoints.length > 0 &&
      allSnippets.length === 0 &&
      params.stackTraces.length === 0
    ) {
      return 'curl';
    }

    return 'nodejs';
  }

  /**
   * Generates a few-shot code synthesis prompt for LLM integration.
   */
  public generateFewShotPrompt(
    params: BugReportParameters,
    language: 'nodejs' | 'python' | 'curl',
    issueTitle?: string,
  ): string {
    return `You are an expert Test Engineer synthesizing an automated bug reproduction script.
Target Language: ${language}
Issue Title: ${issueTitle || 'Bug Report'}

Parameters:
- Steps:
${params.stepsToReproduce.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}
- Expected Behavior: ${params.expectedBehavior}
- Actual Behavior: ${params.actualBehavior}
- Target Endpoints: ${JSON.stringify(params.targetEndpoints)}
- Environment: ${JSON.stringify(params.environment)}

Few-Shot Example (Node.js):
\`\`\`javascript
const assert = require('assert');
async function reproduce() {
  console.log('[REPRO] Step 1: Query API');
  const res = await fetch('http://localhost:3000/api/v1/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test', description: '🚀' }),
  });
  console.log('[REPRO] Response Status:', res.status);
  assert.strictEqual(res.status, 201, 'Expected 201 Created');
}
reproduce().catch((err) => {
  console.error('[BUG REPRODUCED]:', err.message);
  process.exit(1);
});
\`\`\`

Generate a minimal, self-contained, executable reproduction script in ${language} without external dependencies.`;
  }

  /**
   * Synthesizes a standalone, executable reproduction script.
   */
  public generateDeterministicScript(
    params: BugReportParameters,
    language: 'nodejs' | 'python' | 'curl',
    issueTitle?: string,
  ): string {
    const primaryEndpoint = params.targetEndpoints[0] || {
      method: 'GET',
      path: '/api/v1/health',
    };
    const method = primaryEndpoint.method || 'GET';
    const path = primaryEndpoint.path || '/api/v1/health';

    if (language === 'nodejs') {
      const stepsCode = params.stepsToReproduce
        .map(
          (step, idx) =>
            `  // Step ${idx + 1}: ${step.replace(/\r?\n/g, ' ')}\n  console.log('[REPRO STEP ${idx + 1}] ${step.replace(/['\\]/g, '\\$&')}');`,
        )
        .join('\n');

      const payloadCode =
        ['POST', 'PUT', 'PATCH'].includes(method)
          ? `,\n      body: JSON.stringify({\n        test: true,\n        reproCase: 'Bug #${issueTitle ? issueTitle.replace(/['\\]/g, '\\$&') : 'Reproduction'}',\n        timestamp: new Date().toISOString(),\n      })`
          : '';

      return `/**
 * Automated Bug Reproduction Script
 * Issue: ${issueTitle || 'Bug Report'}
 * Generated by CodePulse ReproSynthesizerService
 * 
 * Standalone Node.js reproduction script (Zero external dependencies, Node 18+)
 */

const assert = require('assert');

async function runBugReproduction() {
  const baseUrl = process.env.TARGET_URL || 'http://localhost:3000';
  console.log('[REPRO] Starting reproduction against:', baseUrl);

${stepsCode}

  console.log('[REPRO] Executing HTTP ${method} to ' + baseUrl + '${path}');
  const response = await fetch(baseUrl + '${path}', {
    method: '${method}',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'CodePulse-Repro-Agent/1.0',
    }${payloadCode}
  });

  const statusCode = response.status;
  console.log('[REPRO] Received HTTP Status:', statusCode);

  let responseData;
  try {
    responseData = await response.json();
    console.log('[REPRO] Response payload:', JSON.stringify(responseData, null, 2));
  } catch {
    responseData = await response.text();
    console.log('[REPRO] Response text:', responseData);
  }

  // Verification Assertion
  if (statusCode >= 500) {
    console.error('[BUG REPRODUCED] Confirmed server error: HTTP ' + statusCode);
    console.error('[ACTUAL BEHAVIOR]: ${params.actualBehavior.replace(/['\\]/g, '\\$&').replace(/\r?\n/g, ' ')}');
    process.exit(1);
  } else if (statusCode >= 400) {
    console.warn('[REPRO WARNING] Received client error: HTTP ' + statusCode);
  } else {
    console.log('[REPRO SUCCESS] Request succeeded without crash (HTTP ' + statusCode + ')');
  }
}

runBugReproduction().catch((error) => {
  console.error('[BUG REPRODUCED VIA UNCAUGHT EXCEPTION]:', error.message);
  process.exit(1);
});
`;
    }

    if (language === 'python') {
      const stepsPython = params.stepsToReproduce
        .map(
          (step, idx) =>
            `    # Step ${idx + 1}: ${step.replace(/\r?\n/g, ' ')}\n    print("[REPRO STEP ${idx + 1}] ${step.replace(/["\\]/g, '\\$&')}")`,
        )
        .join('\n');

      return `"""
Automated Bug Reproduction Script
Issue: ${issueTitle || 'Bug Report'}
Generated by CodePulse ReproSynthesizerService

Standalone Python reproduction script (Uses standard library)
"""

import os
import sys
import json
import urllib.request
import urllib.error

def run_reproduction():
    base_url = os.environ.get("TARGET_URL", "http://localhost:3000")
    endpoint = "${path}"
    target_url = f"{base_url}{endpoint}"
    print(f"[REPRO] Starting reproduction against {target_url}")

${stepsPython}

    req = urllib.request.Request(
        target_url,
        method="${method}",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "CodePulse-Repro-Agent/1.0",
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            status = response.getcode()
            body = response.read().decode("utf-8")
            print(f"[REPRO] Received HTTP Status: {status}")
            print(f"[REPRO] Response Body: {body}")
            print("[REPRO SUCCESS] Request completed without reproducing crash.")
    except urllib.error.HTTPError as e:
        print(f"[BUG REPRODUCED] HTTP Error: {e.code} - {e.reason}")
        print(f"[ACTUAL BEHAVIOR]: ${params.actualBehavior.replace(/["\\]/g, '\\$&').replace(/\r?\n/g, ' ')}")
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"[BUG REPRODUCED] Connection Error: {e.reason}")
        sys.exit(1)

if __name__ == "__main__":
    run_reproduction()
`;
    }

    // Default: curl / bash
    const escapedUrl = this.escapeShellArg(`http://localhost:3000${path}`);
    const escapedMethod = this.escapeShellArg(method);
    const stepsBash = params.stepsToReproduce
      .map((step, idx) => `# Step ${idx + 1}: ${step}\necho "[REPRO STEP ${idx + 1}] ${step.replace(/["\\]/g, '\\$&')}"`)
      .join('\n');

    return `#!/usr/bin/env bash
# Automated Bug Reproduction Script
# Issue: ${issueTitle || 'Bug Report'}
# Generated by CodePulse ReproSynthesizerService

set -euo pipefail

TARGET_URL="\${TARGET_URL:-http://localhost:3000}"
ENDPOINT="${path}"
FULL_URL="\${TARGET_URL}\${ENDPOINT}"

echo "[REPRO] Initiating reproduction script against: \${FULL_URL}"

${stepsBash}

echo "[REPRO] Executing curl ${method} \${FULL_URL}"
curl -s -S -X ${escapedMethod} "\${FULL_URL}" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -H "User-Agent: CodePulse-Repro-Agent/1.0" \\
  -w "\\n[REPRO] Response Code: %{http_code}\\nTime: %{time_total}s\\n"

echo "[REPRO] Reproduction curl command completed."
`;
  }

  /**
   * Verifies the syntax of the generated reproduction script.
   */
  public verifyScriptSyntax(
    script: string,
    language: string,
  ): { valid: boolean; errors?: string[] } {
    if (!script || script.trim().length === 0) {
      return { valid: false, errors: ['Script content is empty.'] };
    }

    if (language === 'nodejs' || language === 'typescript' || language === 'javascript') {
      try {
        const sourceFile = ts.createSourceFile(
          'repro_check.ts',
          script,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TS,
        );

        // TypeScript parse diagnostics check
        const parseDiagnostics = (sourceFile as any).parseDiagnostics || [];
        if (parseDiagnostics.length > 0) {
          const errors = parseDiagnostics.map(
            (d: any) =>
              `Line ${d.start ? sourceFile.getLineAndCharacterOfPosition(d.start).line + 1 : 1}: ${d.messageText}`,
          );
          return { valid: false, errors };
        }
        return { valid: true };
      } catch (err: any) {
        return { valid: false, errors: [err.message] };
      }
    }

    if (language === 'python') {
      const errors: string[] = [];
      // Basic syntactic balance checks for Python
      const stack: string[] = [];
      const lines = script.split('\n');

      let inTripleSingle = false;
      let inTripleDouble = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check triple quotes
        if (line.includes('"""')) inTripleDouble = !inTripleDouble;
        if (line.includes("'''")) inTripleSingle = !inTripleSingle;

        if (inTripleDouble || inTripleSingle) continue;

        // Check brackets
        for (const char of line) {
          if (char === '(' || char === '[' || char === '{') {
            stack.push(char);
          } else if (char === ')' || char === ']' || char === '}') {
            const last = stack.pop();
            if (
              (char === ')' && last !== '(') ||
              (char === ']' && last !== '[') ||
              (char === '}' && last !== '{')
            ) {
              errors.push(`Line ${i + 1}: Mismatched bracket '${char}'`);
            }
          }
        }

        // Check colon after def/class/if/elif/else/try/except
        const trimmed = line.trim();
        if (
          /^(def\s+\w+\(.*\)|class\s+\w+|if\s+.*|elif\s+.*|else|try|except(\s+.*)?|with\s+.*)$/.test(
            trimmed,
          ) &&
          !trimmed.endsWith(':')
        ) {
          errors.push(`Line ${i + 1}: Missing colon ':' at end of statement`);
        }
      }

      if (stack.length > 0) {
        errors.push(`Unclosed bracket: ${stack.join(', ')}`);
      }
      if (inTripleDouble || inTripleSingle) {
        errors.push('Unclosed triple quotes in Python script');
      }

      return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
    }

    if (language === 'curl' || language === 'bash') {
      const errors: string[] = [];
      // Check quote balancing in bash
      let singleQuotes = 0;
      let doubleQuotes = 0;
      for (const char of script) {
        if (char === "'") singleQuotes++;
        if (char === '"') doubleQuotes++;
      }
      if (singleQuotes % 2 !== 0) {
        errors.push('Unbalanced single quotes in shell script.');
      }
      if (doubleQuotes % 2 !== 0) {
        errors.push('Unbalanced double quotes in shell script.');
      }
      return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
    }

    return { valid: true };
  }

  /**
   * Generates a reproducible Dockerfile and container execution command for isolated sandbox run.
   */
  public generateSandboxDockerfile(
    language: 'nodejs' | 'python' | 'curl',
  ): { dockerfile: string; runCommand: string } {
    if (language === 'nodejs') {
      const dockerfile = `# CodePulse Reproducible Bug Sandbox (Node.js)
FROM node:20-alpine
WORKDIR /app
COPY repro.js /app/repro.js
USER node
ENV TARGET_URL=http://host.docker.internal:3000
CMD ["node", "/app/repro.js"]
`;
      const runCommand =
        'docker run --rm --add-host=host.docker.internal:host-gateway -v "$(pwd)/repro.js:/app/repro.js:ro" node:20-alpine node /app/repro.js';
      return { dockerfile, runCommand };
    }

    if (language === 'python') {
      const dockerfile = `# CodePulse Reproducible Bug Sandbox (Python)
FROM python:3.11-slim
WORKDIR /app
COPY repro.py /app/repro.py
RUN useradd -m sandboxuser && chown -R sandboxuser /app
USER sandboxuser
ENV TARGET_URL=http://host.docker.internal:3000
CMD ["python", "/app/repro.py"]
`;
      const runCommand =
        'docker run --rm --add-host=host.docker.internal:host-gateway -v "$(pwd)/repro.py:/app/repro.py:ro" python:3.11-slim python /app/repro.py';
      return { dockerfile, runCommand };
    }

    // curl / bash
    const dockerfile = `# CodePulse Reproducible Bug Sandbox (Curl/Alpine)
FROM alpine:3.19
RUN apk add --no-cache curl bash
WORKDIR /app
COPY repro.sh /app/repro.sh
RUN chmod +x /app/repro.sh
USER guest
ENV TARGET_URL=http://host.docker.internal:3000
CMD ["bash", "/app/repro.sh"]
`;
    const runCommand =
      'docker run --rm --add-host=host.docker.internal:host-gateway -v "$(pwd)/repro.sh:/app/repro.sh:ro" alpine:3.19 bash /app/repro.sh';
    return { dockerfile, runCommand };
  }

  /**
   * Formats an automated GitHub helper comment for maintainers.
   */
  public formatReproIssueComment(
    result: Partial<SynthesizedReproResponseDto>,
  ): string {
    const lang = result.targetLanguage || 'nodejs';
    const filename = lang === 'nodejs' ? 'repro.js' : lang === 'python' ? 'repro.py' : 'repro.sh';
    const params = result.parameters;

    const stepsList = params?.stepsToReproduce?.length
      ? params.stepsToReproduce.map((s, idx) => `${idx + 1}. ${s}`).join('\n')
      : '1. Trigger issue conditions';

    return `## 🤖 CodePulse Automated Bug Reproduction Synthesizer

Maintainer triage assistant has analyzed this issue report and synthesized an automated reproduction test case.

---

### 📋 Extracted Bug Parameters
- **Category:** \`${params?.inferredCategory || 'GENERAL'}\`
- **Target Language:** \`${lang}\`
- **Syntax Status:** ${result.syntaxValid ? '✅ **Verified Valid**' : '⚠️ **Syntax Warnings**'}
- **Confidence Score:** \`${Math.round((result.confidenceScore || 0.85) * 100)}%\`

#### 🎯 Reproduction Steps
${stepsList}

- **Expected Behavior:** ${params?.expectedBehavior || 'Success'}
- **Actual Behavior:** \`${params?.actualBehavior || 'Error observed'}\`

---

### 📜 Standalone Reproduction Script (\`${filename}\`)
<details open>
<summary><b>Click to expand standalone reproduction script</b></summary>

\`\`\`${lang === 'curl' ? 'bash' : lang}
${result.scriptContent || ''}
\`\`\`
</details>

---

### 🐳 Run in Isolated Docker Sandbox
Run this reproduction script with zero local configuration:

\`\`\`bash
${result.dockerRunCommand || 'docker run --rm node:20-alpine'}
\`\`\`

---
*Generated automatically by [CodePulse AI Triage Engine](https://github.com/code-with-abhi-i5/CodePulse) (#369).*`;
  }

  /**
   * Posts an automated helper comment to a GitHub issue.
   */
  public async postCommentToGithub(
    repository: string,
    issueNumber: number,
    commentMarkdown: string,
    token?: string,
  ): Promise<{ posted: boolean; commentUrl?: string; error?: string }> {
    const githubToken =
      token ||
      this.configService?.get<string>('GITHUB_TOKEN') ||
      process.env.GITHUB_TOKEN;

    if (!githubToken || !repository || !issueNumber) {
      this.logger.debug(
        `Skipping GitHub comment post: token or repository/issue missing (Repo: ${repository}, Issue: ${issueNumber})`,
      );
      return { posted: false, error: 'GitHub token or target issue not configured.' };
    }

    try {
      const url = `https://api.github.com/repos/${repository}/issues/${issueNumber}/comments`;
      const response = await axios.post(
        url,
        { body: commentMarkdown },
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'CodePulse-Developer-Platform',
          },
        },
      );

      return { posted: true, commentUrl: response.data?.html_url };
    } catch (err: any) {
      this.logger.warn(`Failed to post GitHub comment to ${repository}#${issueNumber}: ${err.message}`);
      return { posted: false, error: err.message };
    }
  }

  /**
   * Main synthesis pipeline: extracts parameters, generates script, verifies syntax,
   * creates sandbox Dockerfile, optionally posts comment, and tracks in IssueRepro analytics.
   */
  public async synthesizeReproductionScript(
    dto: SynthesizeReproRequestDto,
  ): Promise<SynthesizedReproResponseDto> {
    const id = `repro-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const repository = dto.repository || 'code-with-abhi-i5/CodePulse';
    const issueNumber = dto.issueNumber;
    const issueTitle = dto.issueTitle || 'Bug Report';

    // 1. Extract structured parameters from issue body
    const parameters = this.extractBugReportParameters(dto.issueBody, issueTitle);

    // 2. Determine target language
    const targetLanguage = this.detectReproductionLanguage(parameters, dto.targetLanguage);

    // 3. Construct few-shot prompt
    const fewShotPromptUsed = this.generateFewShotPrompt(parameters, targetLanguage, issueTitle);

    // 4. Generate deterministic reproduction script
    const scriptContent = this.generateDeterministicScript(parameters, targetLanguage, issueTitle);

    // 5. Verify script syntax
    const syntaxCheck = this.verifyScriptSyntax(scriptContent, targetLanguage);

    // 6. Generate Docker container runner
    const { dockerfile, runCommand } = this.generateSandboxDockerfile(targetLanguage);

    // 7. Format maintainer helper comment
    const commentMarkdown = this.formatReproIssueComment({
      targetLanguage,
      parameters,
      scriptContent,
      dockerRunCommand: runCommand,
      syntaxValid: syntaxCheck.valid,
      confidenceScore: syntaxCheck.valid ? 0.95 : 0.6,
    });

    // 8. Post comment to GitHub if requested
    let commentPosted = false;
    let commentUrl: string | undefined;

    if (dto.postComment && issueNumber) {
      const postRes = await this.postCommentToGithub(
        repository,
        issueNumber,
        commentMarkdown,
        dto.githubToken,
      );
      commentPosted = postRes.posted;
      commentUrl = postRes.commentUrl;
    }

    const confidenceScore = syntaxCheck.valid ? 0.95 : 0.6;
    const createdAt = new Date().toISOString();

    const result: SynthesizedReproResponseDto = {
      id,
      issueNumber,
      repository,
      targetLanguage,
      scriptContent,
      dockerfileContent: dockerfile,
      dockerRunCommand: runCommand,
      syntaxValid: syntaxCheck.valid,
      syntaxErrors: syntaxCheck.errors,
      parameters,
      fewShotPromptUsed,
      commentMarkdown,
      commentPosted,
      commentUrl,
      confidenceScore,
      createdAt,
    };

    // 9. Persist into Prisma IssueRepro or in-memory fallback
    await this.persistRepro(result);

    return result;
  }

  /**
   * Persists synthesized reproduction into Prisma or in-memory map.
   */
  private async persistRepro(result: SynthesizedReproResponseDto) {
    this.memoryRepros.set(result.id, { ...result });

    if (this.prisma && (this.prisma as any).issueRepro?.create) {
      try {
        await (this.prisma as any).issueRepro.create({
          data: {
            id: result.id,
            issueNumber: result.issueNumber || 0,
            repository: result.repository || 'unknown',
            issueTitle: result.parameters?.targetEndpoints[0]?.path || 'Bug Report',
            targetLanguage: result.targetLanguage,
            scriptContent: result.scriptContent,
            dockerfileContent: result.dockerfileContent,
            stepsExtracted: result.parameters?.stepsToReproduce?.length || 0,
            syntaxValid: result.syntaxValid,
            syntaxErrors: result.syntaxErrors?.join('\n') || null,
            confidenceScore: result.confidenceScore,
            commentPosted: result.commentPosted,
            commentUrl: result.commentUrl || null,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Could not persist IssueRepro into Prisma: ${err.message}`);
      }
    }
  }

  /**
   * Tracks reproduction execution result (success/failure) for analytics.
   */
  public async trackExecutionResult(
    reproId: string,
    dto: TrackReproExecutionDto,
  ): Promise<SynthesizedReproResponseDto> {
    const repro = this.memoryRepros.get(reproId);
    if (!repro) {
      throw new NotFoundException(`Reproduction run ${reproId} not found.`);
    }

    repro.executionSuccess = dto.executionSuccess;
    repro.executionOutput = dto.executionOutput;
    repro.errorLogs = dto.errorLogs;
    this.memoryRepros.set(reproId, repro);

    if (this.prisma && (this.prisma as any).issueRepro?.update) {
      try {
        await (this.prisma as any).issueRepro.update({
          where: { id: reproId },
          data: {
            executionSuccess: dto.executionSuccess,
            executionOutput: dto.executionOutput || null,
            errorLogs: dto.errorLogs || null,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Could not update IssueRepro in Prisma: ${err.message}`);
      }
    }

    return repro;
  }

  /**
   * Retrieves aggregated reproduction synthesizer metrics and success rates.
   */
  public async getReproStats(repository?: string): Promise<ReproStatsDto> {
    const allRepros = Array.from(this.memoryRepros.values()).filter(
      (r) => !repository || r.repository === repository,
    );

    const totalSynthesized = allRepros.length;
    if (totalSynthesized === 0) {
      return {
        totalSynthesized: 0,
        syntaxValidRate: 100,
        executionSuccessRate: 100,
        totalExecuted: 0,
        languageDistribution: {},
        averageStepsExtracted: 0,
      };
    }

    const syntaxValidCount = allRepros.filter((r) => r.syntaxValid).length;
    const executedList = allRepros.filter((r) => r.executionSuccess !== undefined);
    const totalExecuted = executedList.length;
    const executedSuccessCount = executedList.filter((r) => r.executionSuccess === true).length;

    const languageDistribution: Record<string, number> = {};
    let totalSteps = 0;

    for (const r of allRepros) {
      const lang = r.targetLanguage || 'nodejs';
      languageDistribution[lang] = (languageDistribution[lang] || 0) + 1;
      totalSteps += r.parameters?.stepsToReproduce?.length || 0;
    }

    return {
      totalSynthesized,
      syntaxValidRate: Math.round((syntaxValidCount / totalSynthesized) * 1000) / 10,
      executionSuccessRate:
        totalExecuted > 0
          ? Math.round((executedSuccessCount / totalExecuted) * 1000) / 10
          : 100,
      totalExecuted,
      languageDistribution,
      averageStepsExtracted: Math.round((totalSteps / totalSynthesized) * 10) / 10,
    };
  }

  /**
   * Helper called directly from GitHub webhook when an issue is opened or edited.
   */
  public async synthesizeFromWebhookIssue(payload: any): Promise<SynthesizedReproResponseDto | null> {
    const action = payload?.action;
    if (!['opened', 'edited'].includes(action)) {
      return null;
    }

    const issue = payload?.issue;
    if (!issue || !issue.body) {
      return null;
    }

    const bodyText = issue.body || '';
    const titleText = issue.title || '';
    const isBug =
      (issue.labels || []).some((l: any) =>
        (typeof l === 'string' ? l : l.name || '').toLowerCase().includes('bug'),
      ) ||
      /bug|crash|error|fail|repro|broken|exception/i.test(`${titleText} ${bodyText}`);

    if (!isBug) {
      return null;
    }

    return this.synthesizeReproductionScript({
      issueNumber: issue.number,
      issueTitle: titleText,
      issueBody: bodyText,
      repository: payload?.repository?.full_name,
      targetLanguage: 'auto',
      postComment: true,
    });
  }
}
