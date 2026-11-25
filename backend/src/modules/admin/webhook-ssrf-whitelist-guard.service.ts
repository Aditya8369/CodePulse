import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WebhookSsrfWhitelistGuardService {
  private readonly logger = new Logger(WebhookSsrfWhitelistGuardService.name);

  public validateWebhookDestination(targetUrl: string, headers: Record<string, string>): { allowed: boolean; sanitizedHeaders: Record<string, string>; error?: string } {
    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return { allowed: false, sanitizedHeaders: {}, error: 'INVALID_URL' };
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { allowed: false, sanitizedHeaders: {}, error: 'INVALID_PROTOCOL' };
    }

    const host = parsed.hostname.toLowerCase();
    const isPrivate = host === 'localhost' ||
                      host.startsWith('127.') ||
                      host.startsWith('10.') ||
                      host.startsWith('192.168.') ||
                      host === '169.254.169.254';

    if (isPrivate) {
      this.logger.error(`Blocked SSRF attempt to private address: ${host}`);
      return { allowed: false, sanitizedHeaders: {}, error: 'SSRF_PRIVATE_HOST_BLOCKED' };
    }

    // Whitelist headers (block Host, Authorization, Cookie overrides)
    const sanitized: Record<string, string> = {};
    const blockedHeaders = new Set(['host', 'authorization', 'cookie']);

    for (const [k, v] of Object.entries(headers)) {
      if (!blockedHeaders.has(k.toLowerCase())) {
        sanitized[k] = v;
      }
    }

    return { allowed: true, sanitizedHeaders: sanitized };
  }
}
