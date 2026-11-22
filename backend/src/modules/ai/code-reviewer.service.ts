import { Injectable, Logger, Optional } from '@nestjs/common';
import * as ts from 'typescript';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubService } from '../github/github.service';
import { ReviewCommitRequestDto } from './dto/review-commit.dto';

export { ReviewCommitRequestDto };
export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type FindingStatus = 'OPEN' | 'RESOLVED' | 'IGNORED';

export interface CodeReviewFindingDto {
  id?: string;
  commitSha?: string;
  repository?: string;
  filePath: string;
  startLine: number;
  endLine: number;
  ruleId: string;
  severity: FindingSeverity;
  category: string;
  message: string;
  suggestedDiff: string;
  functionScope?: string;
  status: FindingStatus;
}

export interface CommitReviewSummary {
  commitSha: string;
  repository?: string;
  scannedFilesCount: number;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  findings: CodeReviewFindingDto[];
  dashboardSummaryMarkdown: string;
  executionTimeMs: number;
}

@Injectable()
export class CodeReviewerService {
  private readonly logger = new Logger(CodeReviewerService.name);

  // In-memory fallback cache for findings when database is unavailable/mocked
  private memoryFindings: Map<string, CodeReviewFindingDto[]> = new Map();

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly githubService?: GithubService,
  ) {}

  /**
   * Reviews all changed files in a commit using AST static security analysis
   * and generates inline code vulnerability recommendations.
   */
  async reviewCommit(dto: ReviewCommitRequestDto): Promise<CommitReviewSummary> {
    const startTime = Date.now();
    const { commitSha, repository, token } = dto;
    let filesToReview = dto.files || [];

    // If files not supplied, fetch commit diff and files from GithubService
    if (filesToReview.length === 0 && repository && this.githubService) {
      filesToReview = await this.githubService.fetchCommitFiles(repository, commitSha, token);
    }

    const allFindings: CodeReviewFindingDto[] = [];

    for (const file of filesToReview) {
      const findings = this.analyzeFile(file.filePath, file.content);
      for (const f of findings) {
        f.commitSha = commitSha;
        f.repository = repository;
        allFindings.push(f);
      }
    }

    // Persist findings in Prisma
    await this.persistFindings(commitSha, repository, allFindings);

    const criticalCount = allFindings.filter((f) => f.severity === 'CRITICAL').length;
    const highCount = allFindings.filter((f) => f.severity === 'HIGH').length;
    const mediumCount = allFindings.filter((f) => f.severity === 'MEDIUM').length;
    const lowCount = allFindings.filter((f) => f.severity === 'LOW').length;

    const executionTimeMs = Date.now() - startTime;
    const dashboardSummaryMarkdown = this.generateDashboardSummaryMarkdown(
      commitSha,
      repository,
      filesToReview.length,
      allFindings,
    );

    return {
      commitSha,
      repository,
      scannedFilesCount: filesToReview.length,
      findingsCount: allFindings.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      findings: allFindings,
      dashboardSummaryMarkdown,
      executionTimeMs,
    };
  }

  /**
   * Parses AST and analyzes code for OWASP Top 10 vulnerabilities.
   * Supports TypeScript, JavaScript, JSX/TSX, and Python.
   */
  public analyzeFile(filePath: string, code: string): CodeReviewFindingDto[] {
    if (!code || typeof code !== 'string') return [];

    const ext = filePath.split('.').pop()?.toLowerCase();

    if (ext === 'py') {
      return this.analyzePythonCode(filePath, code);
    }

    return this.analyzeTypeScriptCode(filePath, code);
  }

  /**
   * TypeScript / JavaScript AST-based static vulnerability analysis.
   */
  public analyzeTypeScriptCode(filePath: string, code: string): CodeReviewFindingDto[] {
    const findings: CodeReviewFindingDto[] = [];

    let sourceFile: ts.SourceFile;
    try {
      sourceFile = ts.createSourceFile(
        filePath,
        code,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith('.tsx') || filePath.endsWith('.jsx')
          ? ts.ScriptKind.TSX
          : ts.ScriptKind.TS,
      );
    } catch {
      return findings;
    }

    // Track active function scope
    let currentFunctionScope: string | undefined = undefined;

    const visit = (node: ts.Node) => {
      // 1. Function Scope Extraction
      let previousScope: string | undefined = currentFunctionScope;
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node)
      ) {
        if (ts.isFunctionDeclaration(node) && node.name) {
          currentFunctionScope = node.name.text;
        } else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
          currentFunctionScope = node.name.text;
        } else if (ts.isPropertyDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
          currentFunctionScope = node.parent.name.text;
        } else if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
          currentFunctionScope = node.parent.name.text;
        } else {
          currentFunctionScope = 'anonymousFunction';
        }
      }

      // 2. Rule: SQL Injection via Template Literals or Binary String Concatenation
      if (ts.isTaggedTemplateExpression(node) || ts.isTemplateExpression(node)) {
        const text = node.getText(sourceFile);
        if (this.containsSqlKeywords(text) && text.includes('${')) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          findings.push({
            filePath,
            startLine: line + 1,
            endLine: line + 1,
            ruleId: 'OWASP-A03:SQL_INJECTION',
            severity: 'CRITICAL',
            category: 'INJECTION',
            message: 'Potential SQL Injection: unescaped variable interpolated directly into SQL template string.',
            suggestedDiff: `- ${text}\n+ db.query('SELECT ... WHERE id = $1', [variable])`,
            functionScope: currentFunctionScope,
            status: 'OPEN',
          });
        }
      }

      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const text = node.getText(sourceFile);
        if (this.containsSqlKeywords(text) && (ts.isIdentifier(node.right) || ts.isIdentifier(node.left))) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          findings.push({
            filePath,
            startLine: line + 1,
            endLine: line + 1,
            ruleId: 'OWASP-A03:SQL_INJECTION',
            severity: 'CRITICAL',
            category: 'INJECTION',
            message: 'Potential SQL Injection: dynamic SQL constructed using string concatenation (+).',
            suggestedDiff: `- ${text}\n+ db.query('SELECT ... WHERE col = $1', [param])`,
            functionScope: currentFunctionScope,
            status: 'OPEN',
          });
        }
      }

      // 3. Rule: Cross-Site Scripting (XSS) via dangerouslySetInnerHTML or innerHTML
      if (ts.isPropertyAssignment(node) || ts.isJsxAttribute(node)) {
        const name = node.name.getText(sourceFile);
        if (name === 'dangerouslySetInnerHTML' || name === 'innerHTML') {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          findings.push({
            filePath,
            startLine: line + 1,
            endLine: line + 1,
            ruleId: 'OWASP-A03:XSS',
            severity: 'HIGH',
            category: 'SECURITY',
            message: `Cross-Site Scripting (XSS) risk: raw HTML injection via "${name}".`,
            suggestedDiff: `- ${name}={...}\n+ DOMPurify.sanitize(...)`,
            functionScope: currentFunctionScope,
            status: 'OPEN',
          });
        }
      }

      // 4. Rule: Insecure Cryptography (MD5 / SHA1)
      if (ts.isCallExpression(node)) {
        const callText = node.expression.getText(sourceFile);
        if (callText.includes('createHash')) {
          const arg = node.arguments[0];
          if (arg && ts.isStringLiteral(arg)) {
            const algo = arg.text.toLowerCase();
            if (algo === 'md5' || algo === 'sha1') {
              const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
              findings.push({
                filePath,
                startLine: line + 1,
                endLine: line + 1,
                ruleId: 'OWASP-A02:INSECURE_CRYPTO',
                severity: 'HIGH',
                category: 'CRYPTOGRAPHY',
                message: `Insecure cryptographic hashing algorithm: ${algo.toUpperCase()} is cryptographically broken and prone to collision attacks.`,
                suggestedDiff: `- crypto.createHash('${algo}')\n+ crypto.createHash('sha256')`,
                functionScope: currentFunctionScope,
                status: 'OPEN',
              });
            }
          }
        }

        // 5. Rule: Command Injection via child_process.exec
        if (callText === 'exec' || callText === 'child_process.exec') {
          const arg = node.arguments[0];
          if (arg && !ts.isStringLiteral(arg)) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            findings.push({
              filePath,
              startLine: line + 1,
              endLine: line + 1,
              ruleId: 'OWASP-A03:CMD_INJECTION',
              severity: 'CRITICAL',
              category: 'INJECTION',
              message: 'Command Injection vulnerability: untrusted input executed in shell without sanitization.',
              suggestedDiff: `- exec(cmd + param)\n+ execFile(cmd, [param])`,
              functionScope: currentFunctionScope,
              status: 'OPEN',
            });
          }
        }
      }

      // 6. Rule: Hardcoded Secrets / Tokens
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const varName = node.name.text.toUpperCase();
        if (ts.isStringLiteral(node.initializer)) {
          const val = node.initializer.text;
          if (
            (varName.includes('API_KEY') ||
              varName.includes('SECRET') ||
              varName.includes('TOKEN') ||
              varName.includes('PASSWORD') ||
              varName.includes('PRIVATE_KEY')) &&
            val.length >= 8 &&
            !val.includes('env')
          ) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            findings.push({
              filePath,
              startLine: line + 1,
              endLine: line + 1,
              ruleId: 'OWASP-A07:HARDCODED_SECRET',
              severity: 'CRITICAL',
              category: 'SECRETS',
              message: `Hardcoded credential detected in variable "${node.name.text}". Secrets should never be committed into source repositories.`,
              suggestedDiff: `- const ${node.name.text} = "${val}";\n+ const ${node.name.text} = process.env.${varName};`,
              functionScope: currentFunctionScope,
              status: 'OPEN',
            });
          }
        }
      }

      // 7. Rule: ReDoS Vulnerable Regular Expressions
      if (ts.isRegularExpressionLiteral(node)) {
        const regexPattern = node.getText(sourceFile);
        if (this.isRedosVulnerable(regexPattern)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          findings.push({
            filePath,
            startLine: line + 1,
            endLine: line + 1,
            ruleId: 'OWASP-A01:REDOS',
            severity: 'MEDIUM',
            category: 'PERFORMANCE',
            message: 'Regular Expression Denial of Service (ReDoS): pattern contains nested quantifiers causing catastrophic backtracking.',
            suggestedDiff: `Optimize nested quantifiers: rewrite ${regexPattern} to eliminate ambiguous paths.`,
            functionScope: currentFunctionScope,
            status: 'OPEN',
          });
        }
      }

      ts.forEachChild(node, visit);
      currentFunctionScope = previousScope;
    };

    visit(sourceFile);
    return findings;
  }

  /**
   * Python AST-like static security pattern scanner.
   */
  public analyzePythonCode(filePath: string, code: string): CodeReviewFindingDto[] {
    const findings: CodeReviewFindingDto[] = [];
    const lines = code.split('\n');

    let currentFunction = 'module';

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      // Track python function scopes (def ...)
      const defMatch = line.match(/^\s*def\s+([a-zA-Z0-9_]+)\s*\(/);
      if (defMatch) {
        currentFunction = defMatch[1];
      }

      // 1. SQL Injection: formatted f-string or % formatting in cursor.execute
      if (
        (line.includes('.execute(') || line.includes('cursor.execute')) &&
        (line.includes('f"') || line.includes("f'") || line.includes('%') || line.includes('.format('))
      ) {
        findings.push({
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          ruleId: 'OWASP-A03:SQL_INJECTION',
          severity: 'CRITICAL',
          category: 'INJECTION',
          message: 'Python SQL Injection: raw interpolated f-string in database query execution.',
          suggestedDiff: `- cursor.execute(f"SELECT ... WHERE id = {user_id}")\n+ cursor.execute("SELECT ... WHERE id = %s", (user_id,))`,
          functionScope: currentFunction,
          status: 'OPEN',
        });
      }

      // 2. Insecure Crypto: hashlib.md5 or hashlib.sha1
      if (line.includes('hashlib.md5(') || line.includes('hashlib.sha1(')) {
        findings.push({
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          ruleId: 'OWASP-A02:INSECURE_CRYPTO',
          severity: 'HIGH',
          category: 'CRYPTOGRAPHY',
          message: 'Insecure Hash Algorithm: hashlib.md5/sha1 is vulnerable to collision attacks.',
          suggestedDiff: `- hashlib.md5(data)\n+ hashlib.sha256(data)`,
          functionScope: currentFunction,
          status: 'OPEN',
        });
      }

      // 3. Command Injection: os.system or subprocess.call with shell=True
      if (
        line.includes('os.system(') ||
        (line.includes('subprocess.') && line.includes('shell=True'))
      ) {
        findings.push({
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          ruleId: 'OWASP-A03:CMD_INJECTION',
          severity: 'CRITICAL',
          category: 'INJECTION',
          message: 'Python Command Injection: spawning shell commands with shell=True or os.system.',
          suggestedDiff: `- os.system(cmd)\n+ subprocess.run([cmd, arg], check=True)`,
          functionScope: currentFunction,
          status: 'OPEN',
        });
      }

      // 4. Hardcoded Secrets
      const secretMatch = line.match(
        /^\s*(?:API_KEY|SECRET_KEY|TOKEN|PASSWORD|PRIVATE_KEY)\s*=\s*["']([^"']{8,})["']/i,
      );
      if (secretMatch && !secretMatch[1].startsWith('os.environ')) {
        findings.push({
          filePath,
          startLine: lineNum,
          endLine: lineNum,
          ruleId: 'OWASP-A07:HARDCODED_SECRET',
          severity: 'CRITICAL',
          category: 'SECRETS',
          message: 'Hardcoded API secret in Python configuration.',
          suggestedDiff: `- ${line.trim()}\n+ SECRET_KEY = os.environ.get("SECRET_KEY")`,
          functionScope: currentFunction,
          status: 'OPEN',
        });
      }
    }

    return findings;
  }

  /**
   * Detects catastrophic backtracking regex patterns (ReDoS).
   */
  private isRedosVulnerable(pattern: string): boolean {
    const redosSignatures = [
      /\([^)]+[+*]\)[+*]/,          // (group+)+ or (group*)*
      /\([^)]+\|[a-zA-Z0-9_\-.]+\)[+*]/, // (a|aa)+
      /\(\.\*.*\)\{\d+,?\}/,        // (.*a){10}
      /\(\[[^\]]+\]\+\)\+/,        // ([a-z]+)+
    ];
    return redosSignatures.some((re) => re.test(pattern));
  }

  /**
   * Checks for SQL keyword signatures.
   */
  private containsSqlKeywords(text: string): boolean {
    const upper = text.toUpperCase();
    return (
      upper.includes('SELECT ') ||
      upper.includes('INSERT INTO ') ||
      upper.includes('UPDATE ') ||
      upper.includes('DELETE FROM ') ||
      upper.includes('DROP TABLE ')
    );
  }

  /**
   * Persists findings to Prisma and memory cache.
   */
  private async persistFindings(
    commitSha: string,
    repository: string | undefined,
    findings: CodeReviewFindingDto[],
  ): Promise<void> {
    this.memoryFindings.set(commitSha, findings);

    if (!this.prisma?.codeReviewFinding?.create) return;

    try {
      for (const finding of findings) {
        const created = await this.prisma.codeReviewFinding.create({
          data: {
            commitSha,
            repository,
            filePath: finding.filePath,
            startLine: finding.startLine,
            endLine: finding.endLine,
            ruleId: finding.ruleId,
            severity: finding.severity,
            category: finding.category,
            message: finding.message,
            suggestedDiff: finding.suggestedDiff,
            functionScope: finding.functionScope,
            status: finding.status,
          },
        });
        finding.id = created.id;
      }
    } catch (err: any) {
      this.logger.warn(`Could not persist code review findings to database: ${err?.message}`);
    }
  }

  /**
   * Retrieves findings for a commit from database or memory.
   */
  async getFindingsForCommit(commitSha: string): Promise<CodeReviewFindingDto[]> {
    if (this.prisma?.codeReviewFinding?.findMany) {
      try {
        const records = await this.prisma.codeReviewFinding.findMany({
          where: { commitSha },
          orderBy: { severity: 'asc' },
        });
        if (records && records.length > 0) {
          return records.map((r: any) => ({
            id: r.id,
            commitSha: r.commitSha,
            repository: r.repository,
            filePath: r.filePath,
            startLine: r.startLine,
            endLine: r.endLine,
            ruleId: r.ruleId,
            severity: r.severity,
            category: r.category,
            message: r.message,
            suggestedDiff: r.suggestedDiff,
            functionScope: r.functionScope,
            status: r.status,
          }));
        }
      } catch (err: any) {
        this.logger.debug(`Could not query database findings: ${err?.message}`);
      }
    }

    return this.memoryFindings.get(commitSha) || [];
  }

  /**
   * Updates resolution status of a finding (e.g. RESOLVED, IGNORED).
   */
  async updateFindingStatus(id: string, status: FindingStatus): Promise<boolean> {
    if (this.prisma?.codeReviewFinding?.update) {
      try {
        await this.prisma.codeReviewFinding.update({
          where: { id },
          data: { status },
        });
        return true;
      } catch (err: any) {
        this.logger.warn(`Failed to update finding status in database: ${err?.message}`);
      }
    }

    // Update in memory cache
    for (const findings of this.memoryFindings.values()) {
      const match = findings.find((f) => f.id === id);
      if (match) {
        match.status = status;
        return true;
      }
    }

    return false;
  }

  /**
   * Generates formatted GitHub Markdown summary suitable for direct display
   * in the repository inspection dashboard.
   */
  public generateDashboardSummaryMarkdown(
    commitSha: string,
    repository: string | undefined,
    scannedFiles: number,
    findings: CodeReviewFindingDto[],
  ): string {
    const critical = findings.filter((f) => f.severity === 'CRITICAL').length;
    const high = findings.filter((f) => f.severity === 'HIGH').length;
    const medium = findings.filter((f) => f.severity === 'MEDIUM').length;

    let md = `## 🛡️ AI Security & AST Code Review Summary\n\n`;
    md += `**Commit:** \`${commitSha.slice(0, 7)}\`${repository ? ` on \`${repository}\`` : ''}\n`;
    md += `**Scanned Files:** ${scannedFiles} | **Total Findings:** ${findings.length}\n`;
    md += `**Severity:** 🚨 ${critical} Critical | ⚠️ ${high} High | ℹ️ ${medium} Medium\n\n`;

    if (findings.length === 0) {
      md += `> ✅ **Clean Build**: No OWASP Top 10 vulnerabilities or static security flaws detected!\n`;
      return md;
    }

    md += `### 🔍 Security Vulnerability Annotations\n\n`;
    md += `| File | Line | Severity | Rule | Message |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;

    for (const f of findings) {
      const icon = f.severity === 'CRITICAL' ? '🔴' : f.severity === 'HIGH' ? '🟠' : '🟡';
      md += `| \`${f.filePath}\` | L${f.startLine} | ${icon} ${f.severity} | \`${f.ruleId}\` | ${f.message} |\n`;
    }

    md += `\n### 💡 Recommended Fixes\n\n`;
    for (const f of findings.slice(0, 5)) {
      if (f.suggestedDiff) {
        md += `#### \`${f.filePath}:${f.startLine}\` (${f.ruleId})\n`;
        md += `\`\`\`diff\n${f.suggestedDiff}\n\`\`\`\n\n`;
      }
    }

    return md;
  }
}
