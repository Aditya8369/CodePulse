import { Injectable, Logger, Optional } from '@nestjs/common';
import * as ts from 'typescript';
import { PrismaService } from '../../../prisma/prisma.service';

export type AgentPersona = 'SECURITY' | 'PERFORMANCE' | 'CLEAN_CODE';

export interface PrWebhookReviewInput {
  eventAction: 'opened' | 'synchronize' | string;
  prNumber: number;
  authorLogin: string;
  authorType?: 'User' | 'Bot' | string;
  labels?: string[];
  diffContent: string;
  filesChanged: string[];
  contributorFeedback?: string;
}

export interface InlineSuggestionItem {
  path: string;
  line: number;
  persona: AgentPersona;
  message: string;
  replacementLine: string;
  suggestionBlock: string;
}

export interface MultiAgentReviewResult {
  skipped: boolean;
  skipReason?: string;
  rateLimited?: boolean;
  prNumber: number;
  consensusDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'SKIPPED';
  agentSummaries: Record<AgentPersona, { personaPrompt: string; findingCount: number }>;
  inlineSuggestions: InlineSuggestionItem[];
  diffLineCount: number;
  astTokensExtracted: string[];
  latencyMs: number;
}

@Injectable()
export class MultiAgentReviewerService {
  private readonly logger = new Logger(MultiAgentReviewerService.name);
  private readonly recentReviewsByPr = new Map<number, number[]>();
  private readonly audits: MultiAgentReviewResult[] = [];

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  getPersonaPrompt(persona: AgentPersona): string {
    switch (persona) {
      case 'SECURITY':
        return 'Security Agent: audit for hardcoded secrets, SQL/command injection, unsafe innerHTML/eval, and missing auth/validation guards.';
      case 'PERFORMANCE':
        return 'Performance Agent: audit for nested loops/N+1 queries, blocking sync I/O, memory bloat, and unbounded allocations.';
      case 'CLEAN_CODE':
        return 'Clean-Code Agent: audit for explicit types, structured logging instead of console.log, early returns, and clear naming.';
    }
  }

  /**
   * Parses unified diff content into added/modified lines with line numbers and extracts AST tokens.
   */
  parseUnifiedDiffAndAst(diffContent: string, defaultFilePath: string): {
    diffLineCount: number;
    addedLines: Array<{ path: string; line: number; content: string }>;
    astTokensExtracted: string[];
  } {
    const rawLines = diffContent.split('\n');
    let currentPath = defaultFilePath;
    let currentLine = 0;
    const addedLines: Array<{ path: string; line: number; content: string }> = [];
    const codeAccumulator: string[] = [];

    for (const line of rawLines) {
      if (line.startsWith('+++ b/')) {
        currentPath = line.slice('+++ b/'.length).trim();
        continue;
      }
      const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunkMatch) {
        currentLine = Number(hunkMatch[1]);
        continue;
      }
      if (line.startsWith('+') && !line.startsWith('+++')) {
        const clean = line.slice(1);
        addedLines.push({ path: currentPath, line: currentLine, content: clean });
        codeAccumulator.push(clean);
        currentLine += 1;
      } else if (!line.startsWith('-')) {
        if (currentLine > 0) currentLine += 1;
      }
    }

    const sf = ts.createSourceFile(
      defaultFilePath,
      codeAccumulator.join('\n'),
      ts.ScriptTarget.ES2022,
      true,
    );
    const astTokens = new Set<string>();
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node) && node.text.length > 1) {
        astTokens.add(node.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);

    return {
      diffLineCount: rawLines.length,
      addedLines:
        addedLines.length > 0
          ? addedLines
          : rawLines.map((content, idx) => ({
              path: defaultFilePath,
              line: idx + 1,
              content,
            })),
      astTokensExtracted: Array.from(astTokens).slice(0, 30),
    };
  }

  private isRateLimited(prNumber: number, nowMs: number): boolean {
    const windowMs = 60_000;
    const maxPerMinute = 3;
    const prev = (this.recentReviewsByPr.get(prNumber) ?? []).filter(
      (tsMs) => nowMs - tsMs < windowMs,
    );
    if (prev.length >= maxPerMinute) {
      this.recentReviewsByPr.set(prNumber, prev);
      return true;
    }
    prev.push(nowMs);
    this.recentReviewsByPr.set(prNumber, prev);
    return false;
  }

  /**
   * Executes multi-agent consensus review (Security, Performance, Clean-Code)
   * on pull_request.opened / pull_request.synchronize webhook payloads.
   */
  async reviewPullRequestWebhook(
    input: PrWebhookReviewInput,
  ): Promise<MultiAgentReviewResult> {
    const t0 = performance.now();
    const nowMs = Date.now();
    const labels = input.labels ?? [];

    // Guard 1: Skip bot accounts
    const isBot =
      input.authorType === 'Bot' ||
      input.authorLogin.toLowerCase().endsWith('[bot]') ||
      input.authorLogin.toLowerCase().includes('bot');
    if (isBot) {
      return {
        skipped: true,
        skipReason: `Skipped bot account (${input.authorLogin})`,
        prNumber: input.prNumber,
        consensusDecision: 'SKIPPED',
        agentSummaries: {
          SECURITY: { personaPrompt: this.getPersonaPrompt('SECURITY'), findingCount: 0 },
          PERFORMANCE: { personaPrompt: this.getPersonaPrompt('PERFORMANCE'), findingCount: 0 },
          CLEAN_CODE: { personaPrompt: this.getPersonaPrompt('CLEAN_CODE'), findingCount: 0 },
        },
        inlineSuggestions: [],
        diffLineCount: input.diffContent.split('\n').length,
        astTokensExtracted: [],
        latencyMs: Number((performance.now() - t0).toFixed(3)),
      };
    }

    // Guard 2: Skip PRs with [skip-ai] label
    if (labels.some((lbl) => lbl.toLowerCase().includes('skip-ai'))) {
      return {
        skipped: true,
        skipReason: 'Skipped PR marked with [skip-ai] label',
        prNumber: input.prNumber,
        consensusDecision: 'SKIPPED',
        agentSummaries: {
          SECURITY: { personaPrompt: this.getPersonaPrompt('SECURITY'), findingCount: 0 },
          PERFORMANCE: { personaPrompt: this.getPersonaPrompt('PERFORMANCE'), findingCount: 0 },
          CLEAN_CODE: { personaPrompt: this.getPersonaPrompt('CLEAN_CODE'), findingCount: 0 },
        },
        inlineSuggestions: [],
        diffLineCount: input.diffContent.split('\n').length,
        astTokensExtracted: [],
        latencyMs: Number((performance.now() - t0).toFixed(3)),
      };
    }

    // Guard 3: Per-PR rate-limiting safeguard
    if (this.isRateLimited(input.prNumber, nowMs)) {
      return {
        skipped: true,
        rateLimited: true,
        skipReason: `Rate limit exceeded for PR #${input.prNumber}`,
        prNumber: input.prNumber,
        consensusDecision: 'SKIPPED',
        agentSummaries: {
          SECURITY: { personaPrompt: this.getPersonaPrompt('SECURITY'), findingCount: 0 },
          PERFORMANCE: { personaPrompt: this.getPersonaPrompt('PERFORMANCE'), findingCount: 0 },
          CLEAN_CODE: { personaPrompt: this.getPersonaPrompt('CLEAN_CODE'), findingCount: 0 },
        },
        inlineSuggestions: [],
        diffLineCount: input.diffContent.split('\n').length,
        astTokensExtracted: [],
        latencyMs: Number((performance.now() - t0).toFixed(3)),
      };
    }

    const defaultFile = input.filesChanged[0] || 'src/index.ts';
    const parsed = this.parseUnifiedDiffAndAst(input.diffContent, defaultFile);

    const inlineSuggestions: InlineSuggestionItem[] = [];
    let secCount = 0;
    let perfCount = 0;
    let cleanCount = 0;

    for (const item of parsed.addedLines) {
      const code = item.content;

      // Security Agent check
      if (/dangerouslySetInnerHTML|eval\(|child_process\.exec\(/i.test(code)) {
        secCount += 1;
        const safeReplacement = code
          .replace(/dangerouslySetInnerHTML/g, 'children')
          .replace(/eval\(/g, 'JSON.parse(');
        inlineSuggestions.push({
          path: item.path,
          line: item.line,
          persona: 'SECURITY',
          message: 'Security Agent detected unsafe dynamic execution or HTML injection vector.',
          replacementLine: safeReplacement,
          suggestionBlock: `\`\`\`suggestion\n${safeReplacement}\n\`\`\``,
        });
      }

      // Performance Agent check
      if (/\.forEach\([^)]*=>\s*\{[\s\S]*await\b|fs\.readFileSync\(/i.test(code)) {
        perfCount += 1;
        const safeReplacement = code.replace(/fs\.readFileSync\(/g, 'await fs.promises.readFile(');
        inlineSuggestions.push({
          path: item.path,
          line: item.line,
          persona: 'PERFORMANCE',
          message: 'Performance Agent flagged blocking synchronous I/O or sequential loop await.',
          replacementLine: safeReplacement,
          suggestionBlock: `\`\`\`suggestion\n${safeReplacement}\n\`\`\``,
        });
      }

      // Clean-Code Agent check
      if (/console\.log\(/i.test(code) || /:\s*any\b/.test(code)) {
        cleanCount += 1;
        const safeReplacement = code
          .replace(/console\.log\(/g, 'this.logger.log(')
          .replace(/:\s*any\b/g, ': unknown');
        inlineSuggestions.push({
          path: item.path,
          line: item.line,
          persona: 'CLEAN_CODE',
          message: 'Clean-Code Agent recommends structured logging and avoiding implicit/explicit any.',
          replacementLine: safeReplacement,
          suggestionBlock: `\`\`\`suggestion\n${safeReplacement}\n\`\`\``,
        });
      }
    }

    const consensusDecision: 'APPROVED' | 'CHANGES_REQUESTED' =
      secCount === 0 && inlineSuggestions.length === 0
        ? 'APPROVED'
        : 'CHANGES_REQUESTED';

    const latencyMs = Number((performance.now() - t0).toFixed(3));

    const result: MultiAgentReviewResult = {
      skipped: false,
      prNumber: input.prNumber,
      consensusDecision,
      agentSummaries: {
        SECURITY: { personaPrompt: this.getPersonaPrompt('SECURITY'), findingCount: secCount },
        PERFORMANCE: { personaPrompt: this.getPersonaPrompt('PERFORMANCE'), findingCount: perfCount },
        CLEAN_CODE: { personaPrompt: this.getPersonaPrompt('CLEAN_CODE'), findingCount: cleanCount },
      },
      inlineSuggestions,
      diffLineCount: parsed.diffLineCount,
      astTokensExtracted: parsed.astTokensExtracted,
      latencyMs,
    };

    this.audits.push(result);

    if (this.prisma && (this.prisma as any).aiReviewAudit?.create) {
      await (this.prisma as any).aiReviewAudit.create({
        data: {
          prNumber: input.prNumber,
          authorLogin: input.authorLogin,
          consensusDecision,
          securityFindingCount: secCount,
          performanceFindingCount: perfCount,
          cleanCodeFindingCount: cleanCount,
          suggestionCount: inlineSuggestions.length,
          contributorFeedback: input.contributorFeedback ?? null,
          latencyMs: Math.round(latencyMs),
        },
      });
    }

    return result;
  }

  getAudits(): MultiAgentReviewResult[] {
    return [...this.audits];
  }
}
