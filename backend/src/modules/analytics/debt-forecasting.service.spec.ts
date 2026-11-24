import { DebtForecastingService } from './debt-forecasting.service';

describe('DebtForecastingService', () => {
  let service: DebtForecastingService;

  beforeEach(() => {
    service = new DebtForecastingService();
  });

  describe('calculateHalstead', () => {
    it('computes Halstead metrics accurately from known operator and operand counts', () => {
      // Example: distinctOperators = 4, distinctOperands = 4, totalOperators = 8, totalOperands = 8
      // Vocabulary = 8, Length = 16
      // Volume = 16 * log2(8) = 16 * 3 = 48
      // Difficulty = (4 / 2) * (8 / 4) = 2 * 2 = 4
      // Effort = 4 * 48 = 192
      // Time = 192 / 18 = 10.67s
      // Bugs = 48 / 3000 = 0.016
      const metrics = service.calculateHalstead({
        distinctOperators: 4,
        distinctOperands: 4,
        totalOperators: 8,
        totalOperands: 8,
      });

      expect(metrics.vocabulary).toBe(8);
      expect(metrics.length).toBe(16);
      expect(metrics.volume).toBeCloseTo(48, 1);
      expect(metrics.difficulty).toBe(4);
      expect(metrics.effort).toBeCloseTo(192, 1);
      expect(metrics.timeToProgramSeconds).toBeCloseTo(10.67, 1);
      expect(metrics.deliveredBugs).toBeCloseTo(0.016, 3);
    });

    it('extracts operators and operands from raw code string', () => {
      const code = `
        function calculateTotal(price, taxRate) {
          if (price <= 0) {
            return 0;
          }
          const tax = price * taxRate;
          return price + tax;
        }
      `;
      const metrics = service.calculateHalstead(code);

      expect(metrics.distinctOperators).toBeGreaterThan(0);
      expect(metrics.distinctOperands).toBeGreaterThan(0);
      expect(metrics.volume).toBeGreaterThan(0);
      expect(metrics.difficulty).toBeGreaterThan(0);
      expect(metrics.effort).toBeGreaterThan(0);
    });
  });

  describe('calculateCyclomaticComplexity', () => {
    it('calculates cyclomatic complexity based on decision points + 1', () => {
      const simpleCode = `const x = 10; return x;`;
      expect(service.calculateCyclomaticComplexity(simpleCode)).toBe(1);

      const branchedCode = `
        function test(a, b) {
          if (a > 0 && b > 0) {
            for (let i = 0; i < a; i++) {
              if (i === 2) continue;
            }
          } else if (a < 0 || b < 0) {
            return -1;
          }
          return a ? b : 0;
        }
      `;
      // Branch points: if (1), && (1), for (1), if (1), else if (1), || (1), ternary ? (1) => baseline 1 + 7 = 8
      const cc = service.calculateCyclomaticComplexity(branchedCode);
      expect(cc).toBeGreaterThanOrEqual(7);
    });
  });

  describe('calculateMaintainabilityIndex', () => {
    it('accurately computes Maintainability Index on 0-100 scale', () => {
      // Clean, well-structured module
      const highMi = service.calculateMaintainabilityIndex({
        halsteadVolume: 80,
        cyclomaticComplexity: 2,
        loc: 25,
        commentRatio: 0.25,
      });

      expect(highMi).toBeGreaterThanOrEqual(75);
      expect(highMi).toBeLessThanOrEqual(100);

      // Highly complex, monolithic god module
      const lowMi = service.calculateMaintainabilityIndex({
        halsteadVolume: 15000,
        cyclomaticComplexity: 65,
        loc: 2500,
        commentRatio: 0.02,
      });

      expect(lowMi).toBeLessThan(50);
      expect(lowMi).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateChurnVelocity', () => {
    it('measures lines churned per day and bug-fix density', () => {
      const commits = [
        { additions: 120, deletions: 30, message: 'feat: add websocket endpoint' },
        { additions: 15, deletions: 10, message: 'fix: resolve race condition in cache' },
        { additions: 45, deletions: 5, message: 'fix: hotfix memory leak in stream' },
        { additions: 80, deletions: 20, message: 'chore: update dependencies' },
      ];

      const res = service.calculateChurnVelocity(commits, 10);
      expect(res.totalChurnLines).toBe(325);
      expect(res.churnVelocity).toBeCloseTo(32.5, 1);
      expect(res.bugFixRatio).toBe(0.5); // 2 out of 4 commits
    });
  });

  describe('identifyHotspots', () => {
    it('identifies and ranks top 5 hotspot files with actionable refactoring advice', () => {
      const hotspots = service.generateDefaultHotspots();

      expect(hotspots).toHaveLength(5);
      expect(hotspots[0].rank).toBe(1);
      expect(hotspots[4].rank).toBe(5);

      // Verify rank ordering: hotspotScore descending
      for (let i = 0; i < hotspots.length - 1; i++) {
        expect(hotspots[i].hotspotScore).toBeGreaterThanOrEqual(hotspots[i + 1].hotspotScore);
      }

      // Verify each hotspot has actionable recommendations
      for (const h of hotspots) {
        expect(h.recommendations.length).toBeGreaterThan(0);
        expect(typeof h.recommendations[0]).toBe('string');
        expect(h.riskSeverity).toMatch(/CRITICAL|HIGH|MEDIUM/);
      }
    });
  });

  describe('trainForecastModel and generate30DayDegradationCurve', () => {
    it('trains regression and Holt-Winters model predicting 30-day degradation curve with 95% confidence intervals', () => {
      const history = [
        { dayOffset: -27, maintainabilityIndex: 82.0 },
        { dayOffset: -21, maintainabilityIndex: 80.5 },
        { dayOffset: -15, maintainabilityIndex: 79.0 },
        { dayOffset: -9, maintainabilityIndex: 77.8 },
        { dayOffset: -3, maintainabilityIndex: 76.5 },
        { dayOffset: 0, maintainabilityIndex: 75.0 },
      ];

      const { curve, model } = service.generate30DayDegradationCurve(history);

      expect(model.trendDirection).toBe('DEGRADING');
      expect(model.slope).toBeLessThan(0);
      expect(model.rSquared).toBeGreaterThan(0.9);
      expect(curve).toHaveLength(31); // day 0 to day 30

      // Verify confidence intervals: low <= prediction <= high
      for (const point of curve) {
        expect(point.confidenceLow).toBeLessThanOrEqual(point.maintainabilityIndex);
        expect(point.confidenceHigh).toBeGreaterThanOrEqual(point.maintainabilityIndex);
        expect(point.maintainabilityIndex).toBeGreaterThanOrEqual(0);
        expect(point.maintainabilityIndex).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('saveMaintainabilitySnapshot & getTechDebtForecast', () => {
    it('saves snapshot to memory store and generates full technical debt forecast report', async () => {
      const saveRes = await service.saveMaintainabilitySnapshot({
        repositoryId: 'test-repo-123',
        filePath: 'src/core/engine.ts',
        maintainabilityIndex: 68.5,
        cyclomaticComplexity: 16,
        halsteadVolume: 2400,
        halsteadDifficulty: 14.5,
        halsteadEffort: 34800,
        churnVelocity: 18.4,
        bugFixRatio: 0.35,
        loc: 420,
      });

      expect(saveRes.success).toBe(true);

      const report = await service.getTechDebtForecast('test-repo-123');
      expect(report.repositoryId).toBe('test-repo-123');
      expect(report.currentMetrics.averageMaintainabilityIndex).toBeGreaterThan(0);
      expect(report.dailyDegradationCurve.length).toBe(31);
      expect(report.monthlyForecastTimeline.length).toBe(7); // -3 to +3
      expect(report.topHotspots.length).toBe(5);
      expect(report.summaryInsights.length).toBeGreaterThan(0);
    });
  });
});

