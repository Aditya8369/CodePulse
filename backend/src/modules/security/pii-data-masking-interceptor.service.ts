import { Injectable } from '@nestjs/common';

@Injectable()
export class PiiDataMaskingInterceptorService {
  public maskPii(text: string): string {
    return text
      // Mask email addresses
      .replace(/([a-zA-Z0-9_-.]+)@([a-zA-Z0-9_-.]+).([a-zA-Z]{2,5})/g, (m, user, domain, ext) => {
        return `${user.charAt(0)}***@${domain}.${ext}`;
      })
      // Mask credit card numbers
      .replace(/\b(?:\d{4}[ -]?){3}\d{4}\b/g, '****-****-****-****')
      // Mask bearer tokens and passwords
      .replace(/(bearer\s+[a-zA-Z0-9_\-\.]+)/gi, 'Bearer [REDACTED]')
      .replace(/(password["']?\s*[:=]\s*["'])([^"']+)(["'])/gi, '$1[REDACTED]$3');
  }
}
