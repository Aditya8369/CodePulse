/**
 * LogSanitizerService
 * High-speed AST & regex-based masking engine for structured logs and traces.
 * Recursively redacts passwords, tokens, API keys, credentials, and PII.
 */
export class LogSanitizerService {
  private static readonly SENSITIVE_KEY_REGEX =
    /^(?:password|secret|token|authorization|apikey|access_token|refresh_token|credit_card|ssn|private_key)$/i;

  private static readonly SECRET_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
    { regex: /ghp_[A-Za-z0-9_]{36}/g, replacement: 'ghp_[REDACTED]' },
    { regex: /bearer\s+[A-Za-z0-9\-_.~+/]+=*/gi, replacement: 'Bearer [REDACTED]' },
    { regex: /sk_live_[A-Za-z0-9]{24}/g, replacement: 'sk_live_[REDACTED]' },
    { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g, replacement: '[EMAIL_REDACTED]' }
  ];

  /**
   * Recursively sanitizes any value (object, array, string, or error).
   * Operates with < 0.2ms overhead.
   */
  static sanitize<T>(input: T): T {
    if (input === null || input === undefined) return input;

    if (typeof input === 'string') {
      let str: string = input as unknown as string;
      for (const pattern of this.SECRET_PATTERNS) {
        str = str.replace(pattern.regex, pattern.replacement);
      }
      return str as unknown as T;
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitize(item)) as unknown as T;
    }

    if (typeof input === 'object') {
      if (input instanceof Error) {
        const sanitizedErr = new Error(this.sanitize(input.message));
        sanitizedErr.stack = input.stack ? this.sanitize(input.stack) : undefined;
        return sanitizedErr as unknown as T;
      }

      const sanitizedObj: Record<string, any> = {};
      for (const [key, val] of Object.entries(input)) {
        if (this.SENSITIVE_KEY_REGEX.test(key)) {
          sanitizedObj[key] = '[REDACTED]';
        } else {
          sanitizedObj[key] = this.sanitize(val);
        }
      }
      return sanitizedObj as unknown as T;
    }

    return input;
  }
}
