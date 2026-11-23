import { Injectable } from '@nestjs/common';

export const SKILL_COMPETENCIES = [
  'Algorithms',
  'Concurrency',
  'Frontend',
  'Security',
  'DevOps',
  'Cryptography',
  'Database',
  'Networking',
  'Clean Code',
  'Performance',
  'Testing',
  'System Design',
] as const;

export type SkillCompetency = (typeof SKILL_COMPETENCIES)[number];

export interface DeveloperActivitySignal {
  userId: string;
  username: string;
  commitSyntaxTokens: string[];
  completedChallenges: Array<{
    challengeId: string;
    tags: string[];
    accuracyRate: number; // 0..1
    executionSpeedPercentile: number; // 0..100
    difficultyWeight: number; // 1..3
  }>;
  codeReviewCleanScore?: number; // 0..100
  testCoveragePercent?: number; // 0..100
}

export interface DeveloperSkillProfile {
  userId: string;
  username: string;
  scores: Record<SkillCompetency, number>; // Normalized 0..100
  unitVector: number[]; // 12D L2-normalized vector
  topCompetencies: SkillCompetency[];
  growthCompetencies: SkillCompetency[];
}

export interface ChallengeCandidate {
  challengeId: string;
  title: string;
  primaryCompetency: SkillCompetency;
  secondaryCompetency?: SkillCompetency;
  targetProficiencyLevel: number; // 0..100
  peerLikedByUserIds?: string[];
}

export interface RecommendedChallengeMatch {
  challengeId: string;
  title: string;
  primaryCompetency: SkillCompetency;
  zpdFitScore: number;
  collaborativeBoost: number;
  expectedEngagementRating: number; // 0..100
  rationale: string;
}

export interface ComplementaryTeamResult {
  teamSize: number;
  members: DeveloperSkillProfile[];
  combinedCoverageByAxis: Record<SkillCompetency, number>;
  overallCoverageScore: number;
  complementarityIndex: number; // 0..1 (higher = less redundant overlap)
}

const SYNTAX_COMPETENCY_MAP: Record<string, SkillCompetency> = {
  dp: 'Algorithms',
  graph: 'Algorithms',
  dijkstra: 'Algorithms',
  trie: 'Algorithms',
  mutex: 'Concurrency',
  atomic: 'Concurrency',
  worker_threads: 'Concurrency',
  async: 'Concurrency',
  jsx: 'Frontend',
  tsx: 'Frontend',
  tailwind: 'Frontend',
  webgl: 'Frontend',
  csrf: 'Security',
  oauth: 'Security',
  sanitize: 'Security',
  rbac: 'Security',
  docker: 'DevOps',
  kubernetes: 'DevOps',
  terraform: 'DevOps',
  ci: 'DevOps',
  ed25519: 'Cryptography',
  aes: 'Cryptography',
  zkp: 'Cryptography',
  sha256: 'Cryptography',
  prisma: 'Database',
  sql: 'Database',
  index: 'Database',
  postgres: 'Database',
  grpc: 'Networking',
  websocket: 'Networking',
  tcp: 'Networking',
  http3: 'Networking',
  refactor: 'Clean Code',
  lint: 'Clean Code',
  solid: 'Clean Code',
  simd: 'Performance',
  cache: 'Performance',
  typedarray: 'Performance',
  profiler: 'Performance',
  vitest: 'Testing',
  jest: 'Testing',
  playwright: 'Testing',
  e2e: 'Testing',
  raft: 'System Design',
  sharding: 'System Design',
  kafka: 'System Design',
  cqrs: 'System Design',
};

@Injectable()
export class SkillMatrixService {
  /**
   * Computes a calibrated 12-dimensional competency vector (0..100 per axis + L2 unit vector)
   * from commit syntax tokens, challenge tags, execution speeds, and accuracy rates.
   */
  computeDeveloperSkillMatrix(signal: DeveloperActivitySignal): DeveloperSkillProfile {
    const rawAccum = new Map<SkillCompetency, number>();
    for (const comp of SKILL_COMPETENCIES) {
      rawAccum.set(comp, 18); // Calibrated baseline prior
    }

    // 1. Commit syntax token signals
    for (const token of signal.commitSyntaxTokens) {
      const normalized = token.trim().toLowerCase();
      const mapped = SYNTAX_COMPETENCY_MAP[normalized];
      if (mapped) {
        rawAccum.set(mapped, (rawAccum.get(mapped) ?? 18) + 6.5);
      }
    }

    // 2. Challenge completion performance (accuracy, execution speed percentile, difficulty)
    for (const ch of signal.completedChallenges) {
      const perfMultiplier =
        Math.max(0.2, Math.min(1, ch.accuracyRate)) *
        (0.65 + 0.35 * (Math.max(0, Math.min(100, ch.executionSpeedPercentile)) / 100)) *
        Math.max(1, ch.difficultyWeight);

      for (const rawTag of ch.tags) {
        const key = rawTag.trim().toLowerCase();
        const direct = SKILL_COMPETENCIES.find((c) => c.toLowerCase() === key);
        const mapped = direct ?? SYNTAX_COMPETENCY_MAP[key];
        if (mapped) {
          rawAccum.set(mapped, (rawAccum.get(mapped) ?? 18) + 14 * perfMultiplier);
        }
      }

      if (ch.executionSpeedPercentile >= 85) {
        rawAccum.set('Performance', (rawAccum.get('Performance') ?? 18) + 7);
      }
    }

    if (typeof signal.codeReviewCleanScore === 'number') {
      rawAccum.set(
        'Clean Code',
        Math.max(rawAccum.get('Clean Code') ?? 18, signal.codeReviewCleanScore),
      );
    }

    if (typeof signal.testCoveragePercent === 'number') {
      rawAccum.set(
        'Testing',
        Math.max(rawAccum.get('Testing') ?? 18, signal.testCoveragePercent),
      );
    }

    const scores = {} as Record<SkillCompetency, number>;
    const rawVec: number[] = [];

    for (const comp of SKILL_COMPETENCIES) {
      // Smooth asymptotic saturation into [0, 100]
      const raw = rawAccum.get(comp) ?? 18;
      const calibrated = Math.min(100, Math.max(0, Math.round(100 * (1 - Math.exp(-raw / 58)))));
      scores[comp] = calibrated;
      rawVec.push(calibrated);
    }

    const l2Norm = Math.sqrt(rawVec.reduce((acc, v) => acc + v * v, 0)) || 1;
    const unitVector = rawVec.map((v) => Number((v / l2Norm).toFixed(5)));

    const sortedAxes = [...SKILL_COMPETENCIES].sort((a, b) => scores[b] - scores[a]);

    return {
      userId: signal.userId,
      username: signal.username,
      scores,
      unitVector,
      topCompetencies: sortedAxes.slice(0, 3),
      growthCompetencies: sortedAxes.slice(-3).reverse(),
    };
  }

  cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dot = 0;
    const len = Math.min(vecA.length, vecB.length);
    for (let i = 0; i < len; i++) {
      dot += vecA[i] * vecB[i];
    }
    return Math.max(0, Math.min(1, Number(dot.toFixed(4))));
  }

  /**
   * Recommends challenges in the developer's Zone of Proximal Development (ZPD: target proficiency
   * +5 to +22 above current skill) combined with collaborative peer similarity filtering.
   */
  recommendChallengesForUser(
    targetUser: DeveloperSkillProfile,
    candidates: ChallengeCandidate[],
    peerProfiles: DeveloperSkillProfile[] = [],
  ): RecommendedChallengeMatch[] {
    const peerSimMap = new Map<string, number>();
    for (const peer of peerProfiles) {
      if (peer.userId !== targetUser.userId) {
        peerSimMap.set(peer.userId, this.cosineSimilarity(targetUser.unitVector, peer.unitVector));
      }
    }

    return candidates
      .map((ch) => {
        const currentSkill = targetUser.scores[ch.primaryCompetency] ?? 50;
        const delta = ch.targetProficiencyLevel - currentSkill;

        // Ideal ZPD stretch is +12 points above current proficiency (Gaussian bell around +12)
        const zpdFitScore = Math.round(100 * Math.exp(-((delta - 12) ** 2) / (2 * 18 ** 2)));

        const likedPeers = ch.peerLikedByUserIds ?? [];
        const avgPeerSim =
          likedPeers.length > 0
            ? likedPeers.reduce((acc, pid) => acc + (peerSimMap.get(pid) ?? 0.75), 0) /
              likedPeers.length
            : 0.82;
        const collaborativeBoost = Math.round(avgPeerSim * 18);

        const expectedEngagementRating = Math.min(
          99,
          Math.max(50, Math.round(zpdFitScore * 0.82 + collaborativeBoost)),
        );

        return {
          challengeId: ch.challengeId,
          title: ch.title,
          primaryCompetency: ch.primaryCompetency,
          zpdFitScore,
          collaborativeBoost,
          expectedEngagementRating,
          rationale: `Targets ${ch.primaryCompetency} (${currentSkill} -> ${ch.targetProficiencyLevel} ZPD stretch) with ${Math.round(avgPeerSim * 100)}% peer affinity`,
        };
      })
      .sort((a, b) => b.expectedEngagementRating - a.expectedEngagementRating);
  }

  /**
   * Greedy max-coverage team matcher assembling hackathon squads of size K
   * with complementary, non-overlapping skill peaks across all 12 axes.
   */
  matchComplementaryTeam(
    pool: DeveloperSkillProfile[],
    teamSize = 3,
  ): ComplementaryTeamResult {
    const k = Math.min(pool.length, Math.max(1, teamSize));
    const selected: DeveloperSkillProfile[] = [];
    const currentMaxPerAxis = new Map<SkillCompetency, number>();
    for (const c of SKILL_COMPETENCIES) currentMaxPerAxis.set(c, 0);

    const remaining = [...pool];

    while (selected.length < k && remaining.length > 0) {
      let bestIdx = 0;
      let bestMarginalGain = -1;

      for (let i = 0; i < remaining.length; i++) {
        const cand = remaining[i];
        let marginalGain = 0;
        for (const axis of SKILL_COMPETENCIES) {
          const prev = currentMaxPerAxis.get(axis) ?? 0;
          const next = cand.scores[axis] ?? 0;
          if (next > prev) {
            marginalGain += next - prev;
          }
        }
        if (marginalGain > bestMarginalGain) {
          bestMarginalGain = marginalGain;
          bestIdx = i;
        }
      }

      const [chosen] = remaining.splice(bestIdx, 1);
      selected.push(chosen);
      for (const axis of SKILL_COMPETENCIES) {
        currentMaxPerAxis.set(
          axis,
          Math.max(currentMaxPerAxis.get(axis) ?? 0, chosen.scores[axis] ?? 0),
        );
      }
    }

    const combinedCoverageByAxis = {} as Record<SkillCompetency, number>;
    let coverageSum = 0;
    for (const axis of SKILL_COMPETENCIES) {
      const val = currentMaxPerAxis.get(axis) ?? 0;
      combinedCoverageByAxis[axis] = val;
      coverageSum += val;
    }

    // Measure pairwise dissimilarity (1 - avg cosine similarity) as complementarity index
    let simPairs = 0;
    let simTotal = 0;
    for (let i = 0; i < selected.length; i++) {
      for (let j = i + 1; j < selected.length; j++) {
        simTotal += this.cosineSimilarity(selected[i].unitVector, selected[j].unitVector);
        simPairs += 1;
      }
    }
    const avgPairwiseSim = simPairs > 0 ? simTotal / simPairs : 0;

    return {
      teamSize: selected.length,
      members: selected,
      combinedCoverageByAxis,
      overallCoverageScore: Number((coverageSum / SKILL_COMPETENCIES.length).toFixed(1)),
      complementarityIndex: Number((1 - avgPairwiseSim).toFixed(3)),
    };
  }
}
