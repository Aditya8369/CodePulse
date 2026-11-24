import { Injectable } from '@nestjs/common';

@Injectable()
export class XmlExternalEntityGuardService {
  public sanitizeXml(xmlPayload: string): { safe: boolean; error?: string } {
    const lower = xmlPayload.toLowerCase();
    // Block DOCTYPE declarations and ENTITY injections
    if (lower.includes('<!doctype') || lower.includes('<!entity') || lower.includes('system') && lower.includes('http://')) {
      return { safe: false, error: 'External entity (XXE) definition prohibited in XML parser' };
    }
    return { safe: true };
  }
}
