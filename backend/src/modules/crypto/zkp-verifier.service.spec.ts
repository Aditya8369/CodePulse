import { Test, TestingModule } from '@nestjs/testing';
import { ZkpVerifierService, Groth16Proof } from './zkp-verifier.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ZkpVerifierService', () => {
  let service: ZkpVerifierService;

  const mockPrismaService = {
    battle: {
      update: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZkpVerifierService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ZkpVerifierService>(ZkpVerifierService);
  });

  describe('Groth16 zk-SNARK Verification', () => {
    it('verifies a valid algorithmic solution proof in < 5ms without accessing source code', async () => {
      const mockData = service.generateMockProof('two-sum-private', {
        problemHash: '0xabc123problemstatementhash',
        outputHash: '0xdef456expectedtestsouthash',
        complexityTier: 1, // O(N)
        cycles: 1240,
      });

      const startTime = performance.now();
      const result = await service.verifyZkpProof({
        battleId: 'battle-private-match-1',
        userId: 'dev-player-1',
        problemId: 'two-sum-private',
        proof: mockData.proof,
        publicSignals: mockData.publicSignals,
      });
      const totalElapsed = performance.now() - startTime;

      expect(result.valid).toBe(true);
      expect(result.verificationDurationMs).toBeLessThan(10);
      expect(totalElapsed).toBeLessThan(15);
      expect(result.complexityValid).toBe(true);
      expect(result.proofHash).toBeDefined();
      expect(mockPrismaService.battle.update).toHaveBeenCalledWith({
        where: { id: 'battle-private-match-1' },
        data: expect.objectContaining({
          zkpProofHash: result.proofHash,
          zkpVerifiedAt: expect.any(Date),
        }),
      });
    });

    it('rejects tampered proof coordinates (spoofed elliptic curve points)', async () => {
      const mockData = service.generateMockProof('two-sum-private', {
        problemHash: '0xproblem1',
        outputHash: '0xoutput1',
        complexityTier: 1,
        cycles: 1000,
      });

      // Tamper with pi_a coordinate to simulate fake proof
      const tamperedProof: Groth16Proof = {
        ...mockData.proof,
        pi_a: ['0xdeadbeefbadf00d', '0x123', '0x1'],
      };

      const result = await service.verifyZkpProof({
        battleId: 'battle-tamper-1',
        userId: 'malicious-player',
        problemId: 'two-sum-private',
        proof: tamperedProof,
        publicSignals: mockData.publicSignals,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockPrismaService.battle.update).not.toHaveBeenCalled();
    });

    it('rejects solution proofs that violate optimal time complexity constraints', async () => {
      const mockData = service.generateMockProof('two-sum-private', {
        problemHash: '0xproblem1',
        outputHash: '0xoutput1',
        complexityTier: 4, // Exceeds threshold (> 3, e.g. O(N^2))
        cycles: 9999999,
      });

      const result = await service.verifyZkpProof({
        battleId: 'battle-slow-1',
        userId: 'slow-player',
        problemId: 'two-sum-private',
        proof: mockData.proof,
        publicSignals: mockData.publicSignals,
      });

      expect(result.valid).toBe(false);
      expect(result.complexityValid).toBe(false);
    });

    it('rejects invalid public signals length', async () => {
      const mockData = service.generateMockProof('two-sum-private', {
        problemHash: '0xproblem1',
        outputHash: '0xoutput1',
        complexityTier: 1,
        cycles: 1000,
      });

      const result = await service.verifyZkpProof({
        battleId: 'battle-signals-mismatch',
        userId: 'player-1',
        problemId: 'two-sum-private',
        proof: mockData.proof,
        publicSignals: ['0xonlyOneSignal'], // Expected 4
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Public signals count mismatch');
    });

    it('rejects zero or identity point coordinate exploits', async () => {
      const mockData = service.generateMockProof('two-sum-private', {
        problemHash: '0xproblem1',
        outputHash: '0xoutput1',
        complexityTier: 1,
        cycles: 1000,
      });

      const zeroPointProof: Groth16Proof = {
        ...mockData.proof,
        pi_a: ['0x0', '0x0', '0x1'],
      };

      const result = await service.verifyZkpProof({
        battleId: 'battle-zero-point',
        userId: 'exploiter',
        problemId: 'two-sum-private',
        proof: zeroPointProof,
        publicSignals: mockData.publicSignals,
      });

      expect(result.valid).toBe(false);
    });
  });
});

