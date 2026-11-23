import {
  SKILL_COMPETENCIES,
  SkillMatrixService,
} from './skill-matrix.service';

describe('SkillMatrixService (12D Vector Normalization, ZPD Recommendations & Team Matching)', () => {
  let service: SkillMatrixService;

  beforeEach(() => {
    service = new SkillMatrixService();
  });

  it('computes a calibrated 12-axis proficiency profile and L2-normalized unit vector', () => {
    const profile = service.computeDeveloperSkillMatrix({
      userId: 'u-algo',
      username: 'sonia',
      commitSyntaxTokens: ['dp', 'graph', 'dijkstra', 'raft', 'mutex', 'vitest'],
      completedChallenges: [
        {
          challengeId: 'ch-1',
          tags: ['Algorithms', 'Performance'],
          accuracyRate: 0.98,
          executionSpeedPercentile: 94,
          difficultyWeight: 2.5,
        },
      ],
      codeReviewCleanScore: 86,
      testCoveragePercent: 88,
    });

    expect(Object.keys(profile.scores)).toHaveLength(SKILL_COMPETENCIES.length);
    expect(profile.unitVector).toHaveLength(12);

    const normSq = profile.unitVector.reduce((acc, v) => acc + v * v, 0);
    expect(normSq).toBeCloseTo(1.0, 3);
    expect(profile.topCompetencies).toContain('Algorithms');
  });

  it('recommends ZPD challenges with >= 85% engagement rating and matches complementary hackathon teams', () => {
    const backendSpecialist = service.computeDeveloperSkillMatrix({
      userId: 'u-1',
      username: 'alice',
      commitSyntaxTokens: ['raft', 'postgres', 'sql', 'grpc', 'docker'],
      completedChallenges: [
        {
          challengeId: 'c1',
          tags: ['System Design', 'Database'],
          accuracyRate: 0.95,
          executionSpeedPercentile: 90,
          difficultyWeight: 2,
        },
      ],
    });

    const frontendSecurityCoder = service.computeDeveloperSkillMatrix({
      userId: 'u-2',
      username: 'bob',
      commitSyntaxTokens: ['tsx', 'webgl', 'tailwind', 'oauth', 'ed25519', 'zkp'],
      completedChallenges: [
        {
          challengeId: 'c2',
          tags: ['Frontend', 'Cryptography', 'Security'],
          accuracyRate: 0.96,
          executionSpeedPercentile: 88,
          difficultyWeight: 2,
        },
      ],
    });

    const duplicateBackendCoder = service.computeDeveloperSkillMatrix({
      userId: 'u-3',
      username: 'charlie',
      commitSyntaxTokens: ['raft', 'postgres', 'docker'],
      completedChallenges: [],
    });

    const recs = service.recommendChallengesForUser(
      backendSpecialist,
      [
        {
          challengeId: 'zpd-1',
          title: 'Consensus Log Compaction Under Network Partition',
          primaryCompetency: 'System Design',
          targetProficiencyLevel: backendSpecialist.scores['System Design'] + 12,
          peerLikedByUserIds: ['u-3'],
        },
      ],
      [duplicateBackendCoder],
    );

    expect(recs[0].expectedEngagementRating).toBeGreaterThanOrEqual(85);

    const team = service.matchComplementaryTeam(
      [backendSpecialist, duplicateBackendCoder, frontendSecurityCoder],
      2,
    );
    const memberIds = team.members.map((m) => m.userId);
    expect(memberIds).toContain('u-1');
    expect(memberIds).toContain('u-2');
    expect(team.complementarityIndex).toBeGreaterThan(0.1);
  });
});
