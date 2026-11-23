import { Test, TestingModule } from '@nestjs/testing';
import { VerificationCoordinatorService } from './verification-coordinator.service';

describe('VerificationCoordinatorService Autonomous Verification Swarm (#1072)', () => {
  let service: VerificationCoordinatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VerificationCoordinatorService],
    }).compile();

    service = module.get<VerificationCoordinatorService>(VerificationCoordinatorService);
  });

  describe('Parallel Swarm Orchestration & Code Health Consensus', () => {
    it('orchestrates 3 agents in parallel and returns verified report for clean algorithmic code', async () => {
      const cleanCode = `
        function binarySearch(arr, target) {
          let left = 0;
          let right = arr.length - 1;
          while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            if (arr[mid] === target) return mid;
            if (arr[mid] < target) left = mid + 1;
            else right = mid - 1;
          }
          return -1;
        }
      `;

      const report = await service.coordinateVerification({ code: cleanCode, language: 'typescript' });

      expect(report.overallVerdict).toBe('VERIFIED');
      expect(report.consensusScore).toBeGreaterThanOrEqual(80);
      expect(report.unprovableLoopRisk).toBe(false);
      expect(report.memoryLeakRisk).toBe(false);
      expect(report.invariantProof.loopTerminationGuaranteed).toBe(true);
      expect(report.invariantProof.status).toBe('PROVEN');
      expect(report.fuzzingSynthesis.synthesizedEdgeCases.length).toBeGreaterThan(0);
    });
  });

  describe('Formal Invariant Prover: Loop Termination Guarantees', () => {
    it('correctly identifies unprovable loop termination when loop counter has no progress step', async () => {
      const buggyLoopCode = `
        function infiniteLoop(n) {
          let i = 0;
          while (i < n) {
            // Bug: i is never incremented!
            console.log("running");
          }
          return i;
        }
      `;

      const report = await service.coordinateVerification({ code: buggyLoopCode, language: 'typescript' });

      expect(report.unprovableLoopRisk).toBe(true);
      expect(report.invariantProof.loopTerminationGuaranteed).toBe(false);
      expect(report.invariantProof.unprovableLoops.length).toBeGreaterThan(0);
      expect(report.invariantProof.unprovableLoops[0]).toContain("loop variable 'i' has no progress step");
      expect(report.overallVerdict).toBe('REJECTED');
    });

    it('correctly identifies infinite loop from while(true) without break condition', async () => {
      const whileTrueCode = `
        function pollServer() {
          while (true) {
            doSomething();
          }
        }
      `;

      const report = await service.coordinateVerification({ code: whileTrueCode, language: 'typescript' });

      expect(report.unprovableLoopRisk).toBe(true);
      expect(report.invariantProof.unprovableLoops[0]).toContain('while(true)');
      expect(report.overallVerdict).toBe('REJECTED');
    });
  });

  describe('Security & Memory Allocation Auditor: Leak Risks', () => {
    it('correctly identifies memory leak risks from unbounded buffer growth in loops', async () => {
      const memoryLeakCode = `
        function leakMemory(stream) {
          const buffer = [];
          while (true) {
            buffer.push(stream.read()); // Unbounded collection growth without size limit
          }
        }
      `;

      const report = await service.coordinateVerification({ code: memoryLeakCode, language: 'typescript' });

      expect(report.memoryLeakRisk).toBe(true);
      expect(report.securityAudit.hasMemoryLeakRisk).toBe(true);
      expect(report.securityAudit.unboundedAllocations.some((a) => a.includes('Unbounded collection growth'))).toBe(true);
      expect(report.securityAudit.riskLevel).toBe('HIGH');
    });

    it('flags uncleaned intervals and persistent timers', async () => {
      const timerCode = `
        function startHeartbeat() {
          setInterval(() => {
            console.log('ping');
          }, 1000);
        }
      `;

      const report = await service.coordinateVerification({ code: timerCode, language: 'typescript' });

      expect(report.memoryLeakRisk).toBe(true);
      expect(report.securityAudit.sideEffectWarnings.some((w) => w.includes('setInterval'))).toBe(true);
    });
  });

  describe('Performance Complexity & Remediation Hints', () => {
    it('identifies quadratic complexity in nested loops and suggests hash index remediation', async () => {
      const nestedCode = `
        function twoSumQuadratic(nums, target) {
          for (let i = 0; i < nums.length; i++) {
            for (let j = i + 1; j < nums.length; j++) {
              if (nums[i] + nums[j] === target) return [i, j];
            }
          }
          return [];
        }
      `;

      const report = await service.coordinateVerification({ code: nestedCode, language: 'typescript' });

      expect(report.performance.bigORuntime).toBe('O(n^2)');
      expect(report.performance.remediationHints.some((h) => h.includes('hash map'))).toBe(true);
    });
  });
});
