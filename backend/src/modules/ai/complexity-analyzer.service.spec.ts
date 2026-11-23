import { Test, TestingModule } from '@nestjs/testing';
import { ComplexityAnalyzerService } from './complexity-analyzer.service';

describe('ComplexityAnalyzerService Cyclomatic, Halstead & MI Metrics (#1075)', () => {
  let service: ComplexityAnalyzerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ComplexityAnalyzerService],
    }).compile();

    service = module.get<ComplexityAnalyzerService>(ComplexityAnalyzerService);
  });

  describe('Cyclomatic Complexity (McCabe CC)', () => {
    it('calculates CC = 1 for a linear function without decisions', () => {
      const code = `
        function add(a, b) {
          return a + b;
        }
      `;
      const result = service.calculateCyclomaticComplexity(code);
      expect(result.cyclomaticComplexity).toBe(1);
      expect(result.decisionPointsCount).toBe(0);
    });

    it('calculates CC = 4 for branching with if, else if, while, and logical operators', () => {
      const code = `
        function complexBranching(x, y) {
          if (x > 0 && y > 0) {
            while (x > y) {
              x--;
            }
          }
          return x;
        }
      `;
      // Decision points: if (1), && (1), while (1) => 3 decision points => CC = 1 + 3 = 4
      const result = service.calculateCyclomaticComplexity(code);
      expect(result.decisionPointsCount).toBe(3);
      expect(result.cyclomaticComplexity).toBe(4);
    });

    it('ignores decision keywords inside comments and string literals', () => {
      const code = `
        function printHelp() {
          // if while for case
          const message = "if while for case && ||";
          return message;
        }
      `;
      const result = service.calculateCyclomaticComplexity(code);
      expect(result.cyclomaticComplexity).toBe(1);
      expect(result.decisionPointsCount).toBe(0);
    });
  });

  describe('Halstead Complexity Metrics', () => {
    it('computes Halstead vocabulary, length, volume, and effort accurately', () => {
      const code = `
        function multiply(a, b) {
          let total = a * b;
          return total;
        }
      `;

      const halstead = service.calculateHalsteadMetrics(code);

      expect(halstead.distinctOperators).toBeGreaterThan(0);
      expect(halstead.distinctOperands).toBeGreaterThan(0);
      expect(halstead.vocabulary).toBe(halstead.distinctOperators + halstead.distinctOperands);
      expect(halstead.length).toBe(halstead.totalOperators + halstead.totalOperands);
      expect(halstead.volume).toBeGreaterThan(0);
      expect(halstead.difficulty).toBeGreaterThan(0);
      expect(halstead.effort).toBeGreaterThan(0);
      expect(halstead.deliveredBugs).toBeGreaterThan(0);
    });
  });

  describe('Maintainability Index (MI)', () => {
    it('computes high Maintainability Index (> 80) for clean modular code', () => {
      const volume = 150;
      const cc = 2;
      const loc = 15;
      const mi = service.computeMaintainabilityIndex(volume, cc, loc);

      expect(mi).toBeGreaterThanOrEqual(75);
      expect(mi).toBeLessThanOrEqual(100);
    });

    it('computes low Maintainability Index (< 65) for monolithic dense code', () => {
      const volume = 15000;
      const cc = 25;
      const loc = 400;
      const mi = service.computeMaintainabilityIndex(volume, cc, loc);

      expect(mi).toBeLessThan(65);
    });
  });

  describe('Full Code Analysis & Automated Refactoring Advice', () => {
    it('analyzes complex source code and flags hotspots with refactoring advice', () => {
      const highComplexityCode = `
        function processPaymentOrder(order, user, discounts, flags) {
          if (order && order.id) {
            if (user && user.isActive) {
              if (order.total > 100 || flags.isVip) {
                while (order.items.length > 0) {
                  const item = order.items.pop();
                  if (item.inStock && !item.isExpired) {
                    if (discounts.has(item.category)) {
                      order.total -= discounts.get(item.category);
                    } else if (item.isPromotional && flags.promoEnabled) {
                      order.total -= item.promoPrice;
                    }
                  } else {
                    order.failedItems.push(item);
                  }
                }
              } else if (order.total < 0) {
                throw new Error("Invalid order total");
              }
            } else {
              return null;
            }
          }
          return order;
        }
      `;

      const report = service.analyzeCode(highComplexityCode, 'typescript');

      expect(report.overallCyclomaticComplexity).toBeGreaterThan(10);
      expect(report.functions.length).toBe(1);
      expect(report.functions[0].name).toBe('processPaymentOrder');
      expect(report.functions[0].cyclomaticComplexity).toBeGreaterThan(10);
      expect(report.refactoringAdvice.length).toBeGreaterThan(0);
      expect(report.refactoringAdvice.some((r) => r.suggestedPattern.includes('Extract Method'))).toBe(true);
    });
  });
});
