import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  VerificationCoordinatorService,
  VerificationRequest,
  SwarmVerificationReport,
  InvariantProofResult,
  SecurityMemoryAuditResult,
  PerformanceComplexityResult,
  FuzzingSynthesisResult,
} from './swarm/verification-coordinator.service';

export * from './swarm/verification-coordinator.service';

export interface VerificationAnalysisRequest {
  code: string;
  language: string;
}

export interface VerificationAnalysisResult {
  bigORuntime: string;
  bigOMemory: string;
  invariantStatus: 'PROVEN' | 'REFUTED' | 'UNKNOWN';
  invariants: string[];
  synthesizedEdgeCases: Array<{ input: string; reason: string }>;
  remediationHints: string[];
}

@Injectable()
export class VerificationSwarmService {
  private readonly logger = new Logger(VerificationSwarmService.name);
  private readonly coordinator: VerificationCoordinatorService;

  constructor(@Optional() coordinator?: VerificationCoordinatorService) {
    this.coordinator = coordinator || new VerificationCoordinatorService();
  }

  /**
   * Coordinates 3 specialized sub-agents: Invariant Prover, Adversarial Fuzzer, and Complexity Explainer
   */
  public async analyzeCode(request: VerificationAnalysisRequest): Promise<VerificationAnalysisResult> {
    const report = await this.coordinator.coordinateVerification({
      code: request.code,
      language: request.language,
    });

    return {
      bigORuntime: report.performance.bigORuntime,
      bigOMemory: report.performance.bigOMemory,
      invariantStatus: report.invariantProof.status,
      invariants: report.invariantProof.invariants,
      synthesizedEdgeCases: report.fuzzingSynthesis.synthesizedEdgeCases,
      remediationHints: report.remediationPlan,
    };
  }

  public async coordinateVerification(request: VerificationRequest): Promise<SwarmVerificationReport> {
    return this.coordinator.coordinateVerification(request);
  }
}
