import { Injectable, BadRequestException } from '@nestjs/common';

class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEndOfWord = false;
}

@Injectable()
export class ContentFilterService {
  private root = new TrieNode();

  // Normalized baseline blocklist
  private readonly profaneWords = [
    'hate', 'scam', 'abuse', 'slur', 'toxic', 'harass', 'malware', 'phishing'
  ];

  // Leet-speak character substitutions
  private readonly charMap: Record<string, string> = {
    '@': 'a',
    '4': 'a',
    '8': 'b',
    '3': 'e',
    '1': 'i',
    '!': 'i',
    '0': 'o',
    '$': 's',
    '5': 's',
    '7': 't',
    '+': 't',
  };

  constructor() {
    for (const word of this.profaneWords) {
      this.insertWord(word);
    }
  }

  private insertWord(word: string) {
    let current = this.root;
    for (const char of word.toLowerCase()) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char)!;
    }
    current.isEndOfWord = true;
  }

  /**
   * Normalizes leet-speak and strips zero-width spaces
   */
  normalizeText(text: string): string {
    let normalized = text
      .toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width chars
      .trim();

    for (const [symbol, letter] of Object.entries(this.charMap)) {
      normalized = normalized.split(symbol).join(letter);
    }

    return normalized;
  }

  /**
   * Validates user content. Throws BadRequestException if policy violation is detected.
   */
  validateContent(text: string, fieldName = 'content'): void {
    if (!text) return;

    const normalized = this.normalizeText(text);
    const tokens = normalized.split(/[^a-z0-9]+/);

    for (const token of tokens) {
      if (!token) continue;

      // Exact or prefix match via Trie
      if (this.containsProfanity(token)) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Content flagged for policy violation',
          message: `The ${fieldName} contains restricted or inappropriate language.`,
        });
      }

      // Levenshtein fuzzy distance check against blocklist (distance <= 1 on 4+ char tokens)
      for (const blocked of this.profaneWords) {
        if (token.length >= 4 && this.levenshteinDistance(token, blocked) <= 1) {
          throw new BadRequestException({
            statusCode: 400,
            error: 'Content flagged for policy violation',
            message: `The ${fieldName} contains obfuscated inappropriate language.`,
          });
        }
      }
    }
  }

  private containsProfanity(word: string): boolean {
    let current = this.root;
    for (const char of word) {
      if (!current.children.has(char)) return false;
      current = current.children.get(char)!;
      if (current.isEndOfWord) return true;
    }
    return current.isEndOfWord;
  }

  private levenshteinDistance(a: string, b: string): number {
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,     // deletion
            dp[i][j - 1] + 1,     // insertion
            dp[i - 1][j - 1] + 1  // substitution
          );
        }
      }
    }

    return dp[a.length][b.length];
  }
}
