import { TyposquatScannerService } from './typosquat-scanner.service';

describe('TyposquatScannerService (AppSec & CycloneDX SBOM)', () => {
  let scanner: TyposquatScannerService;

  beforeEach(() => {
    scanner = new TyposquatScannerService();
  });

  describe('Levenshtein & Damerau-Levenshtein Algorithms', () => {
    it('calculates exact Levenshtein distance', () => {
      expect(scanner.levenshteinDistance('lodash', 'lodsh')).toBe(1); // 1 deletion
      expect(scanner.levenshteinDistance('requests', 'requsts')).toBe(1); // 1 deletion
      expect(scanner.levenshteinDistance('react', 'react')).toBe(0);
    });

    it('accounts for adjacent transpositions with Damerau-Levenshtein', () => {
      expect(scanner.damerauLevenshteinDistance('lodash', 'lodahs')).toBe(1); // 1 transposition
    });
  });

  describe('Typosquatting Detection Against Popular Packages', () => {
    it('instantly flags suspicious packages like lodsh, requsts, or cross-env-sync', () => {
      const lodshAlert = scanner.checkPackage('lodsh');
      expect(lodshAlert).not.toBeNull();
      expect(lodshAlert?.similarTo).toBe('lodash');
      expect(lodshAlert?.blocked).toBe(true);
      expect(lodshAlert?.distance).toBe(1);

      const requstsAlert = scanner.checkPackage('requsts');
      expect(requstsAlert).not.toBeNull();
      expect(requstsAlert?.similarTo).toBe('requests');
      expect(requstsAlert?.blocked).toBe(true);

      const crossEnvAlert = scanner.checkPackage('cross-env-sync');
      expect(crossEnvAlert).not.toBeNull();
      expect(crossEnvAlert?.similarTo).toBe('cross-env');
      expect(crossEnvAlert?.blocked).toBe(true);
    });

    it('permits authentic popular packages without false positives', () => {
      expect(scanner.checkPackage('lodash')).toBeNull();
      expect(scanner.checkPackage('requests')).toBeNull();
      expect(scanner.checkPackage('react')).toBeNull();
      expect(scanner.checkPackage('cross-env')).toBeNull();
    });

    it('blocks packages matching offline malicious hash blacklist', () => {
      const maliciousHash = '4a8a08f09d37b73795649038408b5f330061e32dc31b8c4c72164665a58bbf93';
      const alert = scanner.checkPackage('some-innocent-name', maliciousHash);
      expect(alert).not.toBeNull();
      expect(alert?.isBlacklistedHash).toBe(true);
      expect(alert?.blocked).toBe(true);
    });
  });

  describe('CycloneDX JSON SBOM Generation', () => {
    it('generates standard CycloneDX 1.5 JSON SBOM with component purls', () => {
      const deps = [
        { name: 'react', version: '18.2.0', license: 'MIT' },
        { name: 'axios', version: '1.4.0', license: 'Apache-2.0' },
      ];

      const sbom = scanner.generateCycloneDxSbom('CodePulse Client', deps);
      expect(sbom.bomFormat).toBe('CycloneDX');
      expect(sbom.specVersion).toBe('1.5');
      expect(sbom.components.length).toBe(2);
      expect(sbom.components[0].purl).toBe('pkg:npm/react@18.2.0');
    });

    it('scans project returning both security alerts and generated SBOM', () => {
      const deps = [
        { name: 'lodsh', version: '4.17.21' }, // Typosquat
        { name: 'express', version: '4.18.2' }, // Clean
      ];

      const scan = scanner.scanProject('User Challenge Submission', deps);
      expect(scan.passed).toBe(false);
      expect(scan.flaggedCount).toBe(1);
      expect(scan.alerts[0].packageName).toBe('lodsh');
      expect(scan.sbom.components.length).toBe(2);
    });
  });
});
