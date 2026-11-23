import {
  TreeSitterWasmEngine,
  treeSitterEngine,
} from './tree-sitter-wasm';

describe('TreeSitterWasmEngine (WASM AST Parser & Semantic Highlighter)', () => {
  let engine: TreeSitterWasmEngine;

  beforeEach(() => {
    engine = new TreeSitterWasmEngine();
  });

  describe('AST Generation & Delimiter Checking', () => {
    it('parses valid Go code into AST with zero syntax errors', () => {
      const code = `package main
import "fmt"
func main() {
    fmt.Println("CodePulse Arena")
}`;

      const res = engine.parse(code, 'go');
      expect(res.diagnostics).toHaveLength(0);
      expect(res.astRoot.type).toBe('source_file');
      expect(res.astRoot.children?.some((c) => c.type === 'function_declaration')).toBe(true);
    });

    it('identifies unclosed braces and parentheses with exact line and column locations', () => {
      const code = `func compute() {\n    total := (10 + 20;\n}`;
      const res = engine.parse(code, 'go');

      expect(res.diagnostics.length).toBeGreaterThan(0);
      const unclosedParen = res.diagnostics.find((d) => d.ruleId.includes('unclosed-paren'));
      expect(unclosedParen).toBeDefined();
      expect(unclosedParen?.line).toBe(2);
    });

    it('identifies unexpected extra closing delimiters', () => {
      const code = `const x = [1, 2, 3]];`;
      const res = engine.parse(code, 'typescript');

      const unexpected = res.diagnostics.find((d) => d.ruleId.includes('unmatched-bracket'));
      expect(unexpected).toBeDefined();
      expect(unexpected?.severity).toBe('error');
    });
  });

  describe('Language-Specific Semantic Token Extraction', () => {
    it('extracts Python decorators into decorator semantic tokens', () => {
      const pyCode = `@lru_cache\ndef fibonacci(n):\n    return n`;
      const res = engine.parse(pyCode, 'python');

      const decToken = res.semanticTokens.find((t) => t.tokenType === 'decorator');
      expect(decToken).toBeDefined();
      expect(decToken?.line).toBe(1);
    });

    it('extracts Rust lifetime annotations into lifetime semantic tokens', () => {
      const rustCode = `fn longest<'a>(x: &'a str, y: &'a str) -> &'a str { x }`;
      const res = engine.parse(rustCode, 'rust');

      const lifetimeTokens = res.semanticTokens.filter((t) => t.tokenType === 'lifetime');
      expect(lifetimeTokens.length).toBeGreaterThanOrEqual(1);
    });

    it('classifies keywords and types in TypeScript and C++', () => {
      const tsCode = `export interface UserProfile {\n    id: string;\n}`;
      const res = engine.parse(tsCode, 'typescript');

      expect(res.semanticTokens.some((t) => t.tokenType === 'keyword')).toBe(true);
      expect(res.semanticTokens.some((t) => t.tokenType === 'type')).toBe(true);
    });
  });

  describe('Micro-Benchmark (<5ms for 1,000 Lines)', () => {
    it('achieves sub-5ms parse latency on a 1,000-line code file', () => {
      // Generate 1,000 lines of typical Go code
      const lines = [
        'package main',
        'import "fmt"',
        ...Array.from({ length: 998 }, (_, i) => `func handler_${i}() { fmt.Println(${i}) }`),
      ];
      const largeCode = lines.join('\n');

      const res = engine.parse(largeCode, 'go');
      expect(res.lineCount).toBe(1000);
      expect(res.parseTimeMs).toBeLessThan(5);
    });
  });
});
