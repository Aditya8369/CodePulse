import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DeveloperGraphClient } from './developer-graph';

describe('DeveloperGraphClient', () => {
  let client: DeveloperGraphClient;

  beforeEach(() => {
    DeveloperGraphClient.resetInstance();
    client = DeveloperGraphClient.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches peer recommendations with degree of separation and mutual links', async () => {
    const mockPeers = [
      {
        developer: { id: 'peer_1', username: 'peer_1' },
        degreeOfSeparation: 2,
        connectionPath: ['me', 'bob', 'peer_1'],
        mutualFollowersCount: 1,
        sharedLanguages: ['Rust'],
        sharedRepositories: ['repo-core'],
        recommendationScore: 85,
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPeers,
    });

    const results = await client.getPeerRecommendations('me', 5);

    expect(results.length).toBe(1);
    expect(results[0].developer.username).toBe('peer_1');
    expect(results[0].degreeOfSeparation).toBe(2);
    expect(results[0].sharedLanguages).toContain('Rust');
  });

  it('fetches personalized mentor recommendations filtered by mastered skill', async () => {
    const mockMentors = [
      {
        mentor: { id: 'mentor_sarah', username: 'sarah' },
        masteredSkill: 'Kubernetes',
        proficiencyLevel: 'Master',
        skillScore: 98,
        degreeOfSeparation: 2,
        matchScore: 92,
        connectionPath: ['me', 'elena', 'sarah'],
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMentors,
    });

    const results = await client.getMentorRecommendations('me', 'Kubernetes', 5);

    expect(results.length).toBe(1);
    expect(results[0].mentor.username).toBe('sarah');
    expect(results[0].masteredSkill).toBe('Kubernetes');
    expect(results[0].proficiencyLevel).toBe('Master');
  });

  it('executes 4-degree graph traversal benchmark under 25ms', async () => {
    const mockTraversal = {
      startNodeId: 'dev_alice',
      maxDegreeReached: 4,
      traversalTimeMs: 14.2,
      nodesVisitedCount: 12,
      edgesTraversedCount: 18,
      pathsFoundCount: 10,
      under25msTargetMet: true,
      samplePaths: [],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTraversal,
    });

    const results = await client.traverseNetwork('dev_alice', 4);

    expect(results.under25msTargetMet).toBe(true);
    expect(results.traversalTimeMs).toBeLessThan(25.0);
    expect(results.maxDegreeReached).toBe(4);
  });
});

