import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface RedactionResult {
  redactedText: string;
  redactedCount: number;
  detectedTypes: string[];
  executionTimeMs: number;
}

export interface SensitivePattern {
  name: string;
  tag: string;
  regex: RegExp;
  extractValue?: (match: RegExpExecArray) => string;
}

@Injectable()
export class PiiRedactorService {
  private readonly salt: string;
  private readonly patterns: SensitivePattern[];

  constructor() {
    this.salt = process.env.PII_REDACTION_SALT || 'codepulse-static-secret-salt-2026';

    // DFA / Regex patterns compiled with 'g' and case flags
    this.patterns = [
      // 1. GitHub Personal Access Tokens (classic and fine-grained)
      {
        name: 'GitHub PAT',
        tag: 'ghp',
        regex: /\b(ghp_[a-zA-Z0-9]{36,255}|github_pat_[a-zA-Z0-9_]{40,255}|gho_[a-zA-Z0-9]{36,255}|ghu_[a-zA-Z0-9]{36,255}|ghs_[a-zA-Z0-9]{36,255}|ghr_[a-zA-Z0-9]{36,255})\b/g,
      },
      // 2. AWS Access Key ID
      {
        name: 'AWS Access Key ID',
        tag: 'aws_key',
        regex: /\b((?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16})\b/g,
      },
      // 3. AWS Secret Access Key (standalone 40-char base64-like preceded by keyword or context)
      {
        name: 'AWS Secret Access Key',
        tag: 'aws_secret',
        regex: /(?:\baws_secret_access_key\s*[:=]\s*|\bsecret[_-]?key\s*[:=]\s*)(['"]?)([A-Za-z0-9/+=]{40})\1/gi,
        extractValue: (m) => m[2],
      },
      // 4. RSA / EC / DSA / OpenSSH / PGP Private Keys
      {
        name: 'Private Key',
        tag: 'private_key',
        regex: /-----BEGIN(?: [A-Z0-9_-]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z0-9_-]+)? PRIVATE KEY-----/g,
      },
      {
        name: 'PGP Private Key',
        tag: 'pgp_key',
        regex: /-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]*?-----END PGP PRIVATE KEY BLOCK-----/g,
      },
      // 5. JSON Web Tokens (JWT: header.payload.signature)
      {
        name: 'JWT Token',
        tag: 'jwt',
        regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
      },
      // 6. HTTP Authorization Bearer Tokens
      {
        name: 'Bearer Token',
        tag: 'bearer',
        regex: /\bBearer\s+([A-Za-z0-9\-._~+/]+=*)/gi,
        extractValue: (m) => m[1],
      },
      // 7. Generic API Keys & Tokens with labels
      {
        name: 'API Key',
        tag: 'api_key',
        regex: /(?:api[_-]?key|access[_-]?token|auth[_-]?token|app[_-]?secret)\s*[:=]\s*(['"]?)([a-zA-Z0-9_\-.~]{16,128})\1/gi,
        extractValue: (m) => m[2],
      },
      // 8. Slack Tokens (xoxb-, xoxp-, xoxa-, xoxr-)
      {
        name: 'Slack Token',
        tag: 'slack_token',
        regex: /\b(xox[baprs]-[0-9a-zA-Z]{10,48}-[0-9a-zA-Z]{10,48}-[0-9a-zA-Z]{24,32})\b/g,
      },
      // 9. Stripe API Keys (sk_live_, rk_live_, sk_test_)
      {
        name: 'Stripe Secret Key',
        tag: 'stripe_key',
        regex: /\b([sr]k_(?:live|test)_[0-9a-zA-Z]{24,99})\b/g,
      },
      // 10. OpenAI API Keys (sk-...)
      {
        name: 'OpenAI API Key',
        tag: 'openai_key',
        regex: /\b(sk-[a-zA-Z0-9]{20,64}|sk-proj-[a-zA-Z0-9_-]{40,128})\b/g,
      },
      // 11. Google API Key (AIza...)
      {
        name: 'Google API Key',
        tag: 'google_key',
        regex: /\b(AIza[0-9A-Za-z-_]{35})\b/g,
      },
      // 12. Database Connection Strings (mongodb://, postgres://, redis://, mysql:// with credentials)
      {
        name: 'Database URI',
        tag: 'db_uri',
        regex: /(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^:\s]+:([^@\s]+)@[^\s]+/gi,
        extractValue: (m) => m[1],
      },
      // 13. Password fields in JSON / Key-Value / Query string / log statements
      {
        name: 'Password Field',
        tag: 'password',
        regex: /(?:(?:"(?:password|passwd|pass|secret|client_secret)"\s*:\s*)"([^"]+)")|(?:\b(?:password|passwd)\s*(?:[:=]|(?:is|was))\s*([^\s,;]+))|(?:\bwith password\s+([^\s,;]+))/gi,
        extractValue: (m) => m[1] || m[2] || m[3],
      },
      // 14. Credit Card Numbers (Visa, MasterCard, Amex, Discover with hyphens, spaces or plain digits)
      {
        name: 'Credit Card',
        tag: 'credit_card',
        regex: /\b(?:4[0-9]{3}(?:[- ]?[0-9]{4}){3}|5[1-5][0-9]{2}(?:[- ]?[0-9]{4}){3}|3[47][0-9]{2}[- ]?[0-9]{6}[- ]?[0-9]{5}|3[47][0-9]{13}|6011(?:[- ]?[0-9]{4}){3})\b/g,
      },
      // 15. US Social Security Numbers (SSN: XXX-XX-XXXX)
      {
        name: 'SSN',
        tag: 'ssn',
        regex: /\b\d{3}-\d{2}-\d{4}\b/g,
      },
      // 16. Email Addresses
      {
        name: 'Email Address',
        tag: 'email',
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g,
      },
    ];
  }

  /**
   * Generates a deterministic, non-reversible, salted HMAC-SHA256 hash substring (8 chars)
   */
  public generateHash(secret: string): string {
    return crypto
      .createHmac('sha256', this.salt)
      .update(secret)
      .digest('hex')
      .substring(0, 8);
  }

  /**
   * Format redacted placeholder e.g. [REDACTED:ghp:a1b2c3d4]
   */
  public createRedactedPlaceholder(tag: string, secret: string): string {
    const hash = this.generateHash(secret);
    return `[REDACTED:${tag}:${hash}]`;
  }

  /**
   * Redacts all sensitive tokens and PII from a raw string
   */
  public redactString(text: string): RedactionResult {
    const startTime = process.hrtime.bigint();
    if (!text || typeof text !== 'string') {
      return {
        redactedText: text,
        redactedCount: 0,
        detectedTypes: [],
        executionTimeMs: 0,
      };
    }

    let redacted = text;
    let redactedCount = 0;
    const detectedTypesSet = new Set<string>();

    for (const pattern of this.patterns) {
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;

      // For patterns that extract a sub-group (like Bearer tokens or password values)
      if (pattern.extractValue) {
        // Reset regex
        pattern.regex.lastIndex = 0;
        redacted = redacted.replace(pattern.regex, (fullMatch, ...args) => {
          redactedCount++;
          detectedTypesSet.add(pattern.name);
          // If regex matched groups, construct replacement
          // Match array: [fullMatch, group1, group2, ...]
          const groups = [fullMatch, ...args.slice(0, -2)];
          const secretValue = pattern.extractValue!(groups as unknown as RegExpExecArray);
          const placeholder = this.createRedactedPlaceholder(pattern.tag, secretValue);
          return fullMatch.replace(secretValue, placeholder);
        });
      } else {
        pattern.regex.lastIndex = 0;
        redacted = redacted.replace(pattern.regex, (fullMatch) => {
          redactedCount++;
          detectedTypesSet.add(pattern.name);
          return this.createRedactedPlaceholder(pattern.tag, fullMatch);
        });
      }
    }

    const endTime = process.hrtime.bigint();
    const executionTimeMs = Number(endTime - startTime) / 1_000_000;

    return {
      redactedText: redacted,
      redactedCount,
      detectedTypes: Array.from(detectedTypesSet),
      executionTimeMs,
    };
  }

  /**
   * Deeply sanitizes arbitrary data structures (Objects, Arrays, Errors, Buffers)
   */
  public redactObject<T>(data: T, depth = 0): T {
    if (depth > 10 || data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return this.redactString(data).redactedText as unknown as T;
    }

    if (data instanceof Error) {
      const err = new Error(this.redactString(data.message).redactedText);
      err.name = data.name;
      if (data.stack) {
        err.stack = this.redactString(data.stack).redactedText;
      }
      return err as unknown as T;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.redactObject(item, depth + 1)) as unknown as T;
    }

    if (typeof data === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        const lowerKey = key.toLowerCase();
        // Check if key itself indicates a sensitive credential
        if (
          lowerKey === 'password' ||
          lowerKey === 'authorization' ||
          lowerKey === 'token' ||
          lowerKey === 'secret' ||
          lowerKey === 'apikey' ||
          lowerKey === 'api_key' ||
          lowerKey === 'access_token' ||
          lowerKey === 'refresh_token' ||
          lowerKey === 'client_secret'
        ) {
          if (typeof value === 'string') {
            result[key] = this.createRedactedPlaceholder(lowerKey, value);
          } else {
            result[key] = '[REDACTED:secret]';
          }
        } else {
          result[key] = this.redactObject(value, depth + 1);
        }
      }
      return result as T;
    }

    return data;
  }
}
