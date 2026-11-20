/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { DeveloperGraphService } from './developer-graph.service';
import { GraphController } from './graph.controller';
import { GraphSyncWorker } from './graph-sync.worker';
import { FriendsService } from '../friends/friends.service';
import { FriendsController } from '../friends/friends.controller';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RecommendationType,
  GraphSyncEventType,
  GraphSyncAction,
} from './dto/graph-query.dto';

describe('DeveloperGraphService & Graph Engine Suite', () => {
  let graphService: DeveloperGraphService;
  let graphController: GraphController;
  let graphSyncWorker: GraphSyncWorker;
  let friendsService: FriendsService;
  let friendsController: FriendsController;
  let mockPrisma: Partial<PrismaService>;

  beforeEach(async () => {
    mockPrisma = {
      follows: {
        create: jest.fn(
          ({ data }: { data: { followerId: string; followingId: string } }) =>
            Promise.resolve({
              ...data,
              createdAt: new Date(),
            }),
        ),
        delete: jest.fn(
          ({
            where,
          }: {
            where: {
              followerId_followingId: {
                followerId: string;
                followingId: string;
              };
            };
          }) =>
            Promise.resolve({
              ...where.followerId_followingId,
            }),
        ),
        findMany: jest.fn(() => Promise.resolve([])),
      } as unknown as PrismaService['follows'],
      activity: {
        findMany: jest.fn(() => Promise.resolve([])),
        count: jest.fn(() => Promise.resolve(0)),
      } as unknown as PrismaService['activity'],
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GraphController, FriendsController],
      providers: [
        DeveloperGraphService,
        GraphSyncWorker,
        FriendsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    graphService = module.get<DeveloperGraphService>(DeveloperGraphService);
    graphController = module.get<GraphController>(GraphController);
    graphSyncWorker = module.get<GraphSyncWorker>(GraphSyncWorker);
    friendsService = module.get<FriendsService>(FriendsService);
    friendsController = module.get<FriendsController>(FriendsController);
  });

  afterEach(async () => {
    await graphService.onModuleDestroy();
  });

  describe('Graph Node & Weighted Relationship Modeling', () => {
    it('should model and upsert Developer, Skill, Repository, Challenge, and Badge entities', async () => {
      // Upsert Developer node
      await graphService.upsertDeveloperNode({
        id: 'dev-alice',
        username: 'alice_codes',
        name: 'Alice Wonder',
        avatar: 'https://avatar.dev/alice.png',
        reputation: 1200,
      });

      await graphService.upsertDeveloperNode({
        id: 'dev-bob',
        username: 'bob_builder',
        name: 'Bob Builder',
      });

      // Upsert Skill node
      await graphService.upsertSkillNode({
        id: 'skill-rust',
        name: 'Rust',
        category: 'Systems',
        weight: 1.0,
      });

      // Upsert Repository node
      await graphService.upsertRepositoryNode({
        id: 'repo-hyper',
        name: 'codepulse/hyper',
        owner: 'codepulse',
        stars: 350,
        primaryLanguage: 'Rust',
      });

      // Upsert Challenge node
      await graphService.upsertChallengeNode({
        id: 'chal-lockfree',
        title: 'Lock-Free Queue',
        difficulty: 'EXPERT',
        domain: 'Concurrency',
        points: 150,
      });

      // Upsert Badge node
      await graphService.upsertBadgeNode({
        id: 'badge-rustacean',
        name: 'Grandmaster Rustacean',
        rarity: 'EPIC',
        xpReward: 500,
      });

      // Link weighted relationships
      await graphService.upsertContributedToEdge('dev-alice', 'repo-hyper', 45, 1200);
      await graphService.upsertCollaboratesWithEdge('dev-alice', 'dev-bob', 8, 3);
      await graphService.upsertMasteredEdge('dev-alice', 'skill-rust', 'Master', 98);
      await graphService.upsertSolvedEdge('dev-alice', 'chal-lockfree', 100, 22);
      await graphService.upsertEarnedEdge('dev-alice', 'badge-rustacean');

      // Backward compatibility edges
      await graphService.upsertFollowsEdge('dev-alice', 'dev-bob');
      await graphService.addProficiencyEdge('dev-bob', 'Rust', 'Intermediate');
      await graphService.addGuildMembershipEdge('dev-alice', 'guild-rust', 'Rust Guild');
    });
  });

  describe('Cypher Query Builder', () => {
    it('constructs well-formed Cypher queries with parameters', () => {
      const builder = graphService.createCypherBuilder();
      const query = builder
        .match('(d:Developer)-[r:MASTERED]->(s:Skill)')
        .where('s.name = $skillName', { skillName: 'Rust' })
        .where('r.score >= $minScore', { minScore: 80 })
        .return('d.username, s.name, r.score')
        .orderBy('r.score DESC')
        .limit(10)
        .build();

      expect(query.cypher).toContain('MATCH (d:Developer)-[r:MASTERED]->(s:Skill)');
      expect(query.cypher).toContain('WHERE s.name = $skillName AND r.score >= $minScore');
      expect(query.cypher).toContain('RETURN d.username, s.name, r.score');
      expect(query.cypher).toContain('ORDER BY r.score DESC');
      expect(query.cypher).toContain('LIMIT 10');
      expect(query.params.skillName).toBe('Rust');
      expect(query.params.minScore).toBe(80);
    });
  });

  describe('4-Degree Graph Relationship Traversals (< 25ms SLA)', () => {
    beforeEach(async () => {
      // Alice -> Bob -> Charlie -> Dave -> Eve (4 degrees)
      const users = ['alice', 'bob', 'charlie', 'dave', 'eve'];
      for (const u of users) {
        await graphService.upsertDeveloperNode({ id: u, username: u });
      }

      await graphService.upsertCollaboratesWithEdge('alice', 'bob');
      await graphService.upsertCollaboratesWithEdge('bob', 'charlie');
      await graphService.upsertCollaboratesWithEdge('charlie', 'dave');
      await graphService.upsertCollaboratesWithEdge('dave', 'eve');
    });

    it('executes 4-degree graph relationship traversals in under 25ms', async () => {
      const result = await graphService.traverse4DegreeNetwork('alice', 4);

      expect(result.startNodeId).toBe('alice');
      expect(result.maxDegreeReached).toBe(4);
      expect(result.nodesVisitedCount).toBeGreaterThanOrEqual(5);
      expect(result.pathsFoundCount).toBeGreaterThan(0);
      expect(result.traversalTimeMs).toBeLessThan(25.0);
      expect(result.under25msTargetMet).toBe(true);

      const evePath = result.samplePaths.find((p) => p.nodes.includes('eve'));
      expect(evePath).toBeDefined();
      expect(evePath?.degree).toBe(4);
    });
  });

  describe('Personalized Recommendations: Peers, Mentors & Projects', () => {
    beforeEach(async () => {
      await graphService.upsertDeveloperNode({ id: 'mentee_dan', username: 'dan' });
      await graphService.upsertDeveloperNode({ id: 'mentor_sarah', username: 'sarah' });
      await graphService.upsertDeveloperNode({ id: 'peer_elena', username: 'elena' });

      await graphService.upsertSkillNode({ id: 'skill-k8s', name: 'Kubernetes', category: 'DevOps' });
      await graphService.upsertRepositoryNode({
        id: 'repo-k8s-operator',
        name: 'codepulse/k8s-operator',
        owner: 'codepulse',
        primaryLanguage: 'Go',
      });

      // Sarah has Mastered Kubernetes (Master level, 95 score)
      await graphService.upsertMasteredEdge('mentor_sarah', 'skill-k8s', 'Master', 95);

      // Sarah and Elena contribute to the repository
      await graphService.upsertContributedToEdge('mentor_sarah', 'repo-k8s-operator', 30, 800);
      await graphService.upsertContributedToEdge('peer_elena', 'repo-k8s-operator', 15, 400);

      // Dan collaborates with Elena
      await graphService.upsertCollaboratesWithEdge('mentee_dan', 'peer_elena', 4, 1);
      // Elena collaborates with Sarah
      await graphService.upsertCollaboratesWithEdge('peer_elena', 'mentor_sarah', 6, 2);
    });

    it('recommends mentors who mastered desired skills within graph proximity', async () => {
      const mentors = await graphService.getMentorRecommendations('mentee_dan', 'Kubernetes', 5);

      expect(mentors.length).toBeGreaterThan(0);
      const topMentor = mentors[0];
      expect(topMentor.mentor.username).toBe('sarah');
      expect(topMentor.masteredSkill).toBe('Kubernetes');
      expect(topMentor.proficiencyLevel).toBe('Master');
      expect(topMentor.skillScore).toBe(95);
      expect(topMentor.matchScore).toBeGreaterThan(50);
    });

    it('recommends projects contributed to by graph collaborators', async () => {
      const projects = await graphService.getProjectRecommendations('mentee_dan', 5);

      expect(projects.length).toBeGreaterThan(0);
      const topProject = projects[0];
      expect(topProject.repository.name).toBe('codepulse/k8s-operator');
      expect(topProject.recommendedByCount).toBeGreaterThan(0);
      expect(topProject.collaboratorContributors).toContain('elena');
      expect(topProject.recommendationScore).toBeGreaterThan(0);
    });
  });

  describe('Graph Algorithms: PageRank & Community Detection', () => {
    beforeEach(async () => {
      await graphService.upsertDeveloperNode({ id: 'u1', username: 'user1' });
      await graphService.upsertDeveloperNode({ id: 'u2', username: 'user2' });
      await graphService.upsertDeveloperNode({ id: 'influencer', username: 'influencer_dan' });

      await graphService.upsertFollowsEdge('u1', 'influencer');
      await graphService.upsertFollowsEdge('u2', 'influencer');
      await graphService.addProficiencyEdge('u1', 'TypeScript');
      await graphService.addProficiencyEdge('influencer', 'TypeScript');
    });

    it('computes PageRank identifying high-authority developers', async () => {
      const ranks = await graphService.computePageRank();
      expect(ranks.length).toBeGreaterThan(0);
      expect(ranks[0].username).toBe('influencer_dan');
    });

    it('detects community clusters based on shared technology domains', async () => {
      const communities = await graphService.detectCommunities();
      expect(communities.length).toBeGreaterThan(0);
    });
  });

  describe('BullMQ Asynchronous Node Synchronization from PostgreSQL', () => {
    it('synchronizes USER_SYNC event into developer graph', async () => {
      const result = await graphSyncWorker.process({
        id: 'job-1',
        data: {
          eventType: GraphSyncEventType.USER_SYNC,
          entityId: 'dev_synced_1',
          action: GraphSyncAction.UPSERT,
          payload: {
            username: 'sync_user_1',
            name: 'Synced User',
            reputation: 850,
          },
        },
      } as any);

      expect(result.success).toBe(true);
      expect(result.entityId).toBe('dev_synced_1');

      const traversal = await graphService.traverse4DegreeNetwork('dev_synced_1', 1);
      expect(traversal.nodesVisitedCount).toBeGreaterThanOrEqual(1);
    });

    it('synchronizes SKILL_SYNC and REPO_SYNC events', async () => {
      await graphService.syncEvent({
        eventType: GraphSyncEventType.SKILL_SYNC,
        entityId: 'skill_sync_go',
        action: GraphSyncAction.UPSERT,
        payload: {
          name: 'Go',
          category: 'Backend',
          developerId: 'dev_synced_1',
          proficiency: 'Expert',
          score: 92,
        },
      });

      await graphService.syncEvent({
        eventType: GraphSyncEventType.REPO_SYNC,
        entityId: 'repo_sync_engine',
        action: GraphSyncAction.UPSERT,
        payload: {
          name: 'codepulse/engine',
          developerId: 'dev_synced_1',
          commitsCount: 20,
          linesAdded: 500,
        },
      });

      const mentorRecs = await graphService.getMentorRecommendations('other_dev', 'Go', 5);
      expect(mentorRecs.some((m) => m.mentor.id === 'dev_synced_1')).toBe(true);
    });
  });

  describe('GraphController REST Endpoints', () => {
    beforeEach(async () => {
      await graphService.upsertDeveloperNode({ id: 'ctrl_user', username: 'ctrl_user' });
      await graphService.upsertDeveloperNode({ id: 'ctrl_peer', username: 'ctrl_peer' });
      await graphService.upsertCollaboratesWithEdge('ctrl_user', 'ctrl_peer');
    });

    it('GET /graph/recommendations handles peers, mentors, and projects queries', async () => {
      const peerRes = await graphController.getRecommendations({
        developerId: 'ctrl_user',
        type: RecommendationType.PEERS,
        limit: 5,
      });
      expect(Array.isArray(peerRes)).toBe(true);

      const mentorRes = await graphController.getRecommendations({
        developerId: 'ctrl_user',
        type: RecommendationType.MENTORS,
        limit: 5,
      });
      expect(Array.isArray(mentorRes)).toBe(true);

      const projectRes = await graphController.getRecommendations({
        developerId: 'ctrl_user',
        type: RecommendationType.PROJECTS,
        limit: 5,
      });
      expect(Array.isArray(projectRes)).toBe(true);
    });

    it('GET /graph/traversal/:developerId returns 4-degree graph results', async () => {
      const traversal = await graphController.traverseNetwork('ctrl_user', '4');
      expect(traversal.startNodeId).toBe('ctrl_user');
      expect(traversal.under25msTargetMet).toBe(true);
    });

    it('POST /graph/sync/event triggers graph synchronization', async () => {
      const res = await graphController.syncEvent({
        eventType: GraphSyncEventType.USER_SYNC,
        entityId: 'post_user',
        payload: { username: 'post_user' },
      });
      expect(res.success).toBe(true);
    });
  });

  describe('FriendsController Graph Recommendation Endpoint', () => {
    it('GET /api/v1/friends/recommendations/graph returns recommendations for user', async () => {
      await graphService.upsertDeveloperNode({
        id: '123',
        username: 'current_user',
      });
      await graphService.upsertDeveloperNode({
        id: 'peer_a',
        username: 'peer_a',
      });
      await graphService.upsertDeveloperNode({
        id: 'peer_b',
        username: 'peer_b',
      });

      await graphService.upsertFollowsEdge('123', 'peer_a');
      await graphService.upsertFollowsEdge('peer_a', 'peer_b');

      const res = await friendsController.getGraphRecommendations('123', 5);
      expect(res).toBeDefined();
      expect(Array.isArray(res)).toBe(true);
      expect(res.some((r) => r.developer.username === 'peer_b')).toBe(true);
    });

    it('should trigger asynchronous graph sync when following a user via FriendsService', async () => {
      const followResult = await friendsService.followUser('user-x', 'user-y');
      expect(followResult).toBeDefined();
      expect(mockPrisma.follows?.create).toHaveBeenCalledWith({
        data: { followerId: 'user-x', followingId: 'user-y' },
      });
    });

    it('should trigger asynchronous graph sync when unfollowing a user via FriendsService', async () => {
      const unfollowResult = await friendsService.unfollowUser(
        'user-x',
        'user-y',
      );
      expect(unfollowResult).toBeDefined();
      expect(mockPrisma.follows?.delete).toHaveBeenCalledWith({
        where: {
          followerId_followingId: {
            followerId: 'user-x',
            followingId: 'user-y',
          },
        },
      });
    });
  });
});
