import { Test, TestingModule } from '@nestjs/testing';
import { TyposquatScannerService } from './typosquat-scanner.service';
import { Ecosystem, RiskSeverity } from './dto/scan-package.dto';
import { SecurityController } from './security.controller';

describe('TyposquatScannerService', () => {
  let service: TyposquatScannerService;
  let controller: SecurityController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SecurityController],
      providers: [TyposquatScannerService],
    }).compile();

    service = module.get<TyposquatScannerService>(TyposquatScannerService);
    controller = module.get<SecurityController>(SecurityController);
  });

  describe('Distance Metrics', () => {
    it('should correctly compute Levenshtein distance', () => {
      expect(service.calculateLevenshteinDistance('lodash', 'lodash')).toBe(0);
      expect(service.calculateLevenshteinDistance('lodahs', 'lodash')).toBe(2); // transposition in classic Levenshtein = 2 substitutions
      expect(service.calculateLevenshteinDistance('cross-envv', 'cross-env')).toBe(1);
      expect(service.calculateLevenshteinDistance('react', 'vue')).toBe(5);
    });

    it('should correctly compute Damerau-Levenshtein distance with transposition support', () => {
      expect(service.calculateDamerauLevenshteinDistance('lodash', 'lodash')).toBe(0);
      // 'lodahs' vs 'lodash' is an adjacent character transposition -> distance 1!
      expect(service.calculateDamerauLevenshteinDistance('lodahs', 'lodash')).toBe(1);
      // 'requsets' vs 'requests' is also an adjacent character swap ('us' vs 'su') -> distance 1!
      expect(service.calculateDamerauLevenshteinDistance('requsets', 'requests')).toBe(1);
      expect(service.calculateDamerauLevenshteinDistance('cross-envv', 'cross-env')).toBe(1);
    });
  });

  describe('Unicode Confusables & Visual Homoglyphs', () => {
    it('should detect Cyrillic and Greek homoglyphs targeting popular packages', () => {
      // Cyrillic 'а' (\u0430) instead of Latin 'a'
      const cyrillicReact = 're\u0430ct';
      const result = service.normalizeHomoglyphs(cyrillicReact);
      expect(result.isHomoglyph).toBe(true);
      expect(result.normalized).toBe('react');
    });

    it('should normalize Greek confusables', () => {
      // Greek 'ο' (\u03BF) instead of Latin 'o'
      const greekLodash = 'l\u03BFdash';
      const result = service.normalizeHomoglyphs(greekLodash);
      expect(result.isHomoglyph).toBe(true);
      expect(result.normalized).toBe('lodash');
    });

    it('should identify homoglyph attack on scan and mark as HIGH/CRITICAL and block install', async () => {
      const cyrillicReact = 're\u0430ct';
      const finding = await service.scanPackage({ name: cyrillicReact });
      expect(finding.isHomoglyphAttack).toBe(true);
      expect(finding.normalizedName).toBe('react');
      expect(finding.blockInstall).toBe(true);
      expect([RiskSeverity.HIGH, RiskSeverity.CRITICAL]).toContain(finding.severity);
    });
  });

  describe('Private Namespace Protection', () => {
    it('should block dependencies attempting to register in @codepulse organization scope', async () => {
      const finding = await service.scanPackage({ name: '@codepulse/core-utils' });
      expect(finding.isPrivateNamespaceViolation).toBe(true);
      expect(finding.severity).toBe(RiskSeverity.CRITICAL);
      expect(finding.blockInstall).toBe(true);
      expect(finding.reasons.some((r) => r.includes('protected private organization namespace'))).toBe(true);
    });

    it('should support custom protected namespaces', async () => {
      const finding = await service.scanPackage(
        { name: '@mycorp/internal-tool' },
        ['@mycorp'],
      );
      expect(finding.isPrivateNamespaceViolation).toBe(true);
      expect(finding.severity).toBe(RiskSeverity.CRITICAL);
      expect(finding.blockInstall).toBe(true);
    });
  });

  describe('Typo-Squatting Detection & Distance Thresholds', () => {
    it('should flag "lodahs" as CRITICAL typosquat of "lodash" with blockInstall=true', async () => {
      const finding = await service.scanPackage({ name: 'lodahs', ecosystem: Ecosystem.NPM });
      expect(finding.targetCandidate).toBe('lodash');
      expect(finding.damerauDistance).toBe(1);
      expect(finding.severity).toBe(RiskSeverity.CRITICAL);
      expect(finding.blockInstall).toBe(true);
    });

    it('should flag "cross-envv" as CRITICAL typosquat of "cross-env"', async () => {
      const finding = await service.scanPackage({ name: 'cross-envv', ecosystem: Ecosystem.NPM });
      expect(finding.targetCandidate).toBe('cross-env');
      expect(finding.damerauDistance).toBe(1);
      expect(finding.severity).toBe(RiskSeverity.CRITICAL);
      expect(finding.blockInstall).toBe(true);
    });

    it('should flag PyPI "requsets" as CRITICAL typosquat of "requests"', async () => {
      const finding = await service.scanPackage({ name: 'requsets', ecosystem: Ecosystem.PYPI });
      expect(finding.targetCandidate).toBe('requests');
      expect(finding.damerauDistance).toBe(1);
      expect(finding.severity).toBe(RiskSeverity.CRITICAL);
      expect(finding.blockInstall).toBe(true);
    });

    it('should consider legitimate popular packages safe (LOW risk)', async () => {
      const finding = await service.scanPackage({ name: 'react', ecosystem: Ecosystem.NPM });
      expect(finding.severity).toBe(RiskSeverity.LOW);
      expect(finding.blockInstall).toBe(false);
      expect(finding.reasons.length).toBe(0);
    });
  });

  describe('Registry Reputation & Zero-Day Detection', () => {
    it('should flag newly created packages with low download counts', async () => {
      const finding = await service.scanPackage({ name: 'test-zero-day-pkg-fakepackage' });
      expect(finding.isLowReputationPackage).toBe(true);
      expect(finding.reasons.some((r) => r.includes('Low reputation'))).toBe(true);
    });
  });

  describe('Batch Scanning & Controller Endpoints', () => {
    it('should scan an entire dependency manifest and aggregate severity', async () => {
      const result = await controller.scanDependencies({
        dependencies: [
          { name: 'react', version: '^19.0.0' },
          { name: 'lodahs', version: '4.17.21' },
          { name: '@codepulse/secret-lib', version: '1.0.0' },
        ],
      });

      expect(result.scannedCount).toBe(3);
      expect(result.flaggedCount).toBe(2);
      expect(result.overallSeverity).toBe(RiskSeverity.CRITICAL);
      expect(result.blockRunnerInstall).toBe(true);
    });

    it('should return LOW risk and allow installs when all dependencies are legitimate', async () => {
      const result = await controller.scanDependencies({
        dependencies: [
          { name: 'react' },
          { name: 'lodash' },
          { name: 'express' },
        ],
      });

      expect(result.scannedCount).toBe(3);
      expect(result.flaggedCount).toBe(0);
      expect(result.overallSeverity).toBe(RiskSeverity.LOW);
      expect(result.blockRunnerInstall).toBe(false);
    });

    it('should test single package endpoint', async () => {
      const finding = await controller.scanSinglePackage({
        name: 'requsets',
        ecosystem: Ecosystem.PYPI,
      });
      expect(finding.targetCandidate).toBe('requests');
      expect(finding.blockInstall).toBe(true);
    });
  });
});
