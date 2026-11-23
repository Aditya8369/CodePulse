import { TaintAnalyzerService } from './taint-analyzer.service';

describe('TaintAnalyzerService (Static AST Taint & Sandbox Escape Detection)', () => {
  let analyzer: TaintAnalyzerService;

  beforeEach(() => {
    analyzer = new TaintAnalyzerService();
  });

  it('approves legitimate safe algorithmic solutions', () => {
    const cleanCode = `
      function twoSum(nums: number[], target: number): number[] {
        const map = new Map<number, number>();
        for (let i = 0; i < nums.length; i++) {
          const complement = target - nums[i];
          if (map.has(complement)) {
            return [map.get(complement)!, i];
          }
          map.set(nums[i], i);
        }
        return [];
      }
    `;

    const report = analyzer.analyzeCode(cleanCode, 'typescript');
    expect(report.isSafe).toBe(true);
    expect(report.disqualified).toBe(false);
    expect(report.riskLevel).toBe('SAFE');
    expect(report.violations).toHaveLength(0);
    expect(report.analysisDurationMs).toBeLessThan(15);
  });

  it('detects direct dangerous sinks (child_process, fs, eval) and disqualifies submission', () => {
    const maliciousCode = `
      const cp = require('child_process');
      function solve(input: string) {
        cp.exec('rm -rf /');
        return eval(input);
      }
    `;

    const report = analyzer.analyzeCode(maliciousCode, 'javascript');
    expect(report.isSafe).toBe(false);
    expect(report.disqualified).toBe(true);
    expect(report.riskLevel).toBe('CRITICAL');
    expect(report.violations.length).toBeGreaterThanOrEqual(2);

    const sinkNames = report.violations.map((v) => v.sinkIdentifier);
    expect(sinkNames).toContain('child_process');
    expect(sinkNames).toContain('exec');
    expect(sinkNames).toContain('eval');
  });

  it('detects obfuscated evasion attempts (string concatenation, hex escapes)', () => {
    const obfuscatedCode = `
      function attack() {
        const fn = window['ev' + 'al'];
        const hexCall = "\\x65\\x76\\x61\\x6c('process.exit(1)')";
      }
    `;

    const report = analyzer.analyzeCode(obfuscatedCode, 'javascript');
    expect(report.isSafe).toBe(false);
    expect(report.disqualified).toBe(true);
    expect(report.violations.some((v) => v.message.includes('obfuscated'))).toBe(true);
  });

  it('tracks tainted variable propagation across variable assignments', () => {
    const propagationCode = `
      function handleRequest(input: string) {
        const sanitizedTemp = input;
        const forwardedData = sanitizedTemp;
        eval(forwardedData);
      }
    `;

    const report = analyzer.analyzeCode(propagationCode, 'javascript');
    expect(report.isSafe).toBe(false);
    const evalViolation = report.violations.find((v) => v.sinkIdentifier === 'eval');
    expect(evalViolation).toBeDefined();
    expect(evalViolation?.taintedPath.length).toBeGreaterThanOrEqual(2);
  });

  it('detects Python and C++ dangerous sinks (os.system, popen, fopen)', () => {
    const pythonCode = `
      import os
      def run_job():
          os.system("cat /etc/passwd")
    `;
    const pyReport = analyzer.analyzeCode(pythonCode, 'python');
    expect(pyReport.isSafe).toBe(false);
    expect(pyReport.violations.some((v) => v.sinkIdentifier === 'os.system')).toBe(true);

    const cppCode = `
      #include <iostream>
      int main() {
          system("whoami");
          FILE* f = fopen("secret.txt", "r");
          return 0;
      }
    `;
    const cppReport = analyzer.analyzeCode(cppCode, 'cpp');
    expect(cppReport.isSafe).toBe(false);
    expect(cppReport.violations.some((v) => v.sinkIdentifier === 'system')).toBe(true);
    expect(cppReport.violations.some((v) => v.sinkIdentifier === 'fopen')).toBe(true);
  });
});
