export class LogPIIRedactionFilterService {
  private emailRegex = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;
  private tokenRegex = /(bearer\s+|token\s+)[a-zA-Z0-9._-]+/gi;
  private cardRegex = /\b(?:\d[ -]*?){13,16}\b/g;

  public redact(message: string): string {
    return message
      .replace(this.emailRegex, '[REDACTED_EMAIL]')
      .replace(this.tokenRegex, '$1[REDACTED_TOKEN]')
      .replace(this.cardRegex, '[REDACTED_CARD]');
  }
}
