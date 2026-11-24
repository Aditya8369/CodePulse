export class GitSecretScannerService {
  private keyPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /ghp_[a-zA-Z0-9]{36}/,
    /AKIA[0-9A-Z]{16}/
  ];

  public scanContent(diffText: string): { hasSecret: boolean; matchedPattern?: string } {
    for (const pattern of this.keyPatterns) {
      if (pattern.test(diffText)) {
        return { hasSecret: true, matchedPattern: pattern.source };
      }
    }
    return { hasSecret: false };
  }
}
