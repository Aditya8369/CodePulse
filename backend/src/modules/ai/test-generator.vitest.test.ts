import { describe, it, expect } from 'vitest';
import { TestGeneratorService } from './test-generator.service';

describe('TestGeneratorService (Vitest Native AST & Boundary Verification)', () => {
  it('parses TypeScript signatures directly and verifies all >=8 synthesized edge cases', async () => {
    const generator = new TestGeneratorService();
    const source = `
      export interface Packet { payload: string; }
      export function normalizeText(text: string | null): string {
        if (!text) return '';
        return text.trim();
      }
    `;

    const suite = await generator.synthesizeAndVerifyTestSuite({
      challengeId: 'chal-unicode-1',
      sourceCode: source,
      referenceSolutionFn: (text: string | null) => (typeof text === 'string' ? text.trim() : ''),
    });

    expect(suite.signature.functionName).toBe('normalizeText');
    expect(suite.edgeCases.length).toBeGreaterThanOrEqual(8);
    expect(suite.verifiedAgainstReference).toBe(true);
    expect(suite.typeCheckErrors).toHaveLength(0);
  });
});
