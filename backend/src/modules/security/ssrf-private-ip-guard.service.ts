import { Injectable } from '@nestjs/common';

@Injectable()
export class SsrfPrivateIpGuardService {
  public isUrlSafeForWebhook(urlStr: string): { safe: boolean; reason?: string } {
    try {
      const url = new URL(urlStr);
      const host = url.hostname.toLowerCase();

      // Block cloud metadata services and localhost
      if (host === 'localhost' || host === '127.0.0.1' || host === '169.254.169.254') {
        return { safe: false, reason: 'Localhost and cloud metadata service endpoints are blocked' };
      }

      // Block private IP ranges (RFC 1918)
      if (host.startsWith('10.') || host.startsWith('192.168.') || /^172.(1[6-9]|2[0-9]|3[0-1])./.test(host)) {
        return { safe: false, reason: 'Private internal subnet ranges blocked' };
      }

      // Enforce HTTPS
      if (url.protocol !== 'https:') {
        return { safe: false, reason: 'Only secure HTTPS protocols are permitted' };
      }

      return { safe: true };
    } catch {
      return { safe: false, reason: 'Malformed URL' };
    }
  }
}
