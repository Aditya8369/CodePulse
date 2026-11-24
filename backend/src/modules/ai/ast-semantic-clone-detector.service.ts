import { Injectable, Logger } from '@nestjs/common';

export interface CloneDetectionResult {
  similarity: number;
  isClone: boolean;
  cloneType: 'TYPE_1_EXACT' | 'TYPE_2_RENAMED' | 'TYPE_3_STRUCTURAL' | 'NONE';
  canonicalTokensA: string[];
  canonicalTokensB: string[];
}

@Injectable()
export class AstSemanticCloneDetectorService {
  private readonly logger = new Logger(AstSemanticCloneDetectorService.name);

  public normalizeAstStructure(code: string): string[] {
    const keywords = new Set(['return', 'function', 'if', 'else', 'for', 'while', 'class', 'const', 'let', 'var']);
    const rawTokens = code
      .replace(/([{}();,=+*\/<>!?-])/g, ' $1 ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    let varCount = 0;
    const identifierMap = new Map<string, string>();

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
        return identifierMap.get(token)!;
      }
      return token;
    });
  }

  public computeSimilarity(codeA: string, codeB: string): CloneDetectionResult {
    const tokensA = this.normalizeAstStructure(codeA);
    const tokensB = this.normalizeAstStructure(codeB);

    if (tokensA.length === 0 && tokensB.length === 0) {
      return {
        similarity: 1.0,
        isClone: true,
        cloneType: 'TYPE_1_EXACT',
        canonicalTokensA: tokensA,
        canonicalTokensB: tokensB,
      };
    }

    if (tokensA.length === 0 || tokensB.length === 0) {
      return {
        similarity: 0.0,
        isClone: false,
        cloneType: 'NONE',
        canonicalTokensA: tokensA,
        canonicalTokensB: tokensB,
      };
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
    let cloneType: CloneDetectionResult['cloneType'] = 'NONE';
    if (similarity === 1.0) {
      cloneType = codeA.trim() === codeB.trim() ? 'TYPE_1_EXACT' : 'TYPE_2_RENAMED';
    } else if (similarity >= 0.7) {
      cloneType = 'TYPE_3_STRUCTURAL';
    }

    return {
      similarity,
      isClone: similarity >= 0.7,
      cloneType,
      canonicalTokensA: tokensA,
      canonicalTokensB: tokensB,
    };
  }
}
