import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AstSemanticCloneDetectorService {
  normalizeAstStructure(code) {
    const keywords = new Set(['return', 'function', 'if', 'else', 'for', 'while', 'class', 'const', 'let', 'var']);
    const rawTokens = code
      .replace(/([{}();,=+*\/<>!?-])/g, ' $1 ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    let varCount = 0;
    const identifierMap = new Map();

    return rawTokens.map(token => {
      if (['const', 'let', 'var'].includes(token)) {
        return 'VAR_KW';
      }
      if (keywords.has(token)) {
        return token.toUpperCase();
      }
      if (/^[0-9]+(\.[0-9]+)?$/.test(token) || /^['"].*['"]$/.test(token)) {
        return 'LITERAL';
      }
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(token)) {
        if (!identifierMap.has(token)) {
          varCount++;
          identifierMap.set(token, 'VAR_' + varCount);
        }
        return identifierMap.get(token);
      }
      return token;
    });
  }

  computeSimilarity(codeA, codeB) {
    const tokensA = this.normalizeAstStructure(codeA);
    const tokensB = this.normalizeAstStructure(codeB);

    if (tokensA.length === 0 && tokensB.length === 0) {
      return { similarity: 1.0, isClone: true, cloneType: 'TYPE_1_EXACT' };
    }
    if (tokensA.length === 0 || tokensB.length === 0) {
      return { similarity: 0.0, isClone: false, cloneType: 'NONE' };
    }

    let matching = 0;
    const minLen = Math.min(tokensA.length, tokensB.length);
    const maxLen = Math.max(tokensA.length, tokensB.length);

    for (let i = 0; i < minLen; i++) {
      if (tokensA[i] === tokensB[i]) {
        matching++;
      }
    }

    const similarity = parseFloat((matching / maxLen).toFixed(4));
    let cloneType = 'NONE';
    if (similarity === 1.0) {
      cloneType = codeA.trim() === codeB.trim() ? 'TYPE_1_EXACT' : 'TYPE_2_RENAMED';
    } else if (similarity >= 0.7) {
      cloneType = 'TYPE_3_STRUCTURAL';
    }

    return { similarity, isClone: similarity >= 0.7, cloneType };
  }
}

describe('AstSemanticCloneDetectorService (#2265)', () => {
  test('detects renamed-variable Type-2 semantic clone with 1.0 similarity', () => {
    const detector = new AstSemanticCloneDetectorService();
    const c1 = 'const x = 10; return x * 2;';
    const c2 = 'let y = 10; return y * 2;';
    const result = detector.computeSimilarity(c1, c2);
    assert.strictEqual(result.similarity, 1.0);
    assert.strictEqual(result.isClone, true);
    assert.strictEqual(result.cloneType, 'TYPE_2_RENAMED');
  });

  test('detects Type-1 exact match', () => {
    const detector = new AstSemanticCloneDetectorService();
    const c1 = 'function calc(a) { return a * 10; }';
    const result = detector.computeSimilarity(c1, c1);
    assert.strictEqual(result.similarity, 1.0);
    assert.strictEqual(result.cloneType, 'TYPE_1_EXACT');
  });

  test('distinguishes disparate logic', () => {
    const detector = new AstSemanticCloneDetectorService();
    const c1 = 'for (let i = 0; i < 10; i++) { console.log(i); }';
    const c2 = 'return null;';
    const result = detector.computeSimilarity(c1, c2);
    assert.strictEqual(result.isClone, false);
    assert.ok(result.similarity < 0.3);
  });
});
