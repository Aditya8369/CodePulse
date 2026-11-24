import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SamlSignatureWrappingGuardService {
  private readonly logger = new Logger(SamlSignatureWrappingGuardService.name);

  public validateAssertionStructure(samlXml: string): { isValid: boolean; error?: string } {
    // Detect duplicate Assertion elements (classic XML Signature Wrapping attack)
    const assertionMatches = samlXml.match(/<([a-zA-Z0-9]+:)?Assertion/g);
    if (assertionMatches && assertionMatches.length > 1) {
      this.logger.warn('Multiple Assertion elements detected in SAML response. Flagging possible XSW attack.');
      return { isValid: false, error: 'XSW_DETECTED_MULTIPLE_ASSERTIONS' };
    }

    if (!samlXml.includes('<Signature') && !samlXml.includes(':Signature')) {
      return { isValid: false, error: 'MISSING_SIGNATURE' };
    }

    return { isValid: true };
  }
}
