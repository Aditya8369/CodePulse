export class ASTQueryTaintFirewallService {
  public isQueryTainted(query: string): { tainted: boolean; reason?: string } {
    const lower = query.toLowerCase();

    // Check for obvious raw string injection markers
    if (lower.includes('--') || lower.includes('; drop ') || lower.includes("' or '1'='1")) {
      return { tainted: true, reason: 'Detected SQL injection pattern' };
    }

    if (lower.includes('$where') || lower.includes('$gt: ""')) {
      return { tainted: true, reason: 'Detected NoSQL taint injection pattern' };
    }

    return { tainted: false };
  }
}
