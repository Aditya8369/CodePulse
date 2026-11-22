import { GdprShredderService } from './gdpr-shredder.service';

describe('GdprShredderService (Right-to-be-Forgotten Cryptographic Shredder)', () => {
  let service: GdprShredderService;

  beforeEach(() => {
    service = new GdprShredderService();
  });

  describe('PII Scrambling and Ghost Handle Generation', () => {
    it('generates consistent Ghost-Dev-XXXX handle for user ID', () => {
      const handle1 = service.generateGhostHandle('user-12345');
      const handle2 = service.generateGhostHandle('user-12345');
      expect(handle1).toMatch(/^Ghost-Dev-[A-Z0-9]{6}$/);
      expect(handle1).toBe(handle2);
    });

    it('generates HMAC-scrambled email removing original PII', () => {
      const email = service.generateShreddedEmail('user-12345');
      expect(email).toMatch(/^shredded_[a-f0-9]{16}@anonymous\.codepulse\.io$/);
      expect(email).not.toContain('user-12345');
    });
  });

  describe('Full Shredding Transaction and Certificate Issuance', () => {
    it('shreds user PII and issues cryptographically verifiable deletion certificate', async () => {
      const userId = 'usr-target-gdpr-99';
      const result = await service.shredUser(userId);

      expect(result.success).toBe(true);
      expect(result.anonymizedUser.id).toBe(userId); // Relational integrity preserved!
      expect(result.anonymizedUser.username).toMatch(/^Ghost-Dev-/);
      expect(result.anonymizedUser.email).toContain('@anonymous.codepulse.io');

      const cert = result.certificate;
      expect(cert.complianceStandard).toBe('GDPR_ARTICLE_17_RIGHT_TO_BE_FORGOTTEN');
      expect(cert.hmacSignature).toBeDefined();
      expect(cert.sha256CertificateDigest).toBeDefined();

      // Certificate passes cryptographic verification
      const isValid = service.verifyCertificate(cert);
      expect(isValid).toBe(true);
    });

    it('rejects tampered deletion certificates', async () => {
      const result = await service.shredUser('user-tamper-test');
      const tamperedCert = {
        ...result.certificate,
        anonymizedHandle: 'Forged-Name', // Tampered field
      };

      const isValid = service.verifyCertificate(tamperedCert);
      expect(isValid).toBe(false);
    });
  });
});
