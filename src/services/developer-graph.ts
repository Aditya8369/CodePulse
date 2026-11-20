/**
 * Developer Knowledge Graph & Social Trajectory Client Service
 * Connects to Neo4j / Memgraph REST endpoints for collaborative filtering,
 * mentor matching, project recommendations, PageRank influence, and multi-degree traversals.
 */

export interface DeveloperNode {
  id: string;
  username: string;
  name?: string;
  avatar?: string;
  influenceScore?: number;
}

export interface PeerRecommendation {
  developer: DeveloperNode;
  degreeOfSeparation: number;
  connectionPath: string[];
  mutualFollowersCount: number;
  sharedLanguages: string[];
  sharedRepositories: string[];
  recommendationScore: number;
}

export interface MentorRecommendation {
  mentor: DeveloperNode;
  masteredSkill: string;
  proficiencyLevel: string;
  skillScore: number;
  degreeOfSeparation: number;
  matchScore: number;
  connectionPath: string[];
}

export interface ProjectRecommendation {
  repository: {
    id: string;
    name: string;
    owner?: string;
    stars?: number;
    primaryLanguage?: string;
  };
  recommendedByCount: number;
  collaboratorContributors: string[];
  matchingSkills: string[];
  recommendationScore: number;
}

export interface GraphTraversalBenchmark {
  startNodeId: string;
  maxDegreeReached: number;
  traversalTimeMs: number;
  nodesVisitedCount: number;
  edgesTraversedCount: number;
  pathsFoundCount: number;
  under25msTargetMet: boolean;
  samplePaths: Array<{
    nodes: string[];
    relationships: string[];
    degree: number;
  }>;
}

export class DeveloperGraphClient {
  private static instance: DeveloperGraphClient | null = null;
  private readonly baseUrl: string;

  public constructor(baseUrl: string = '/api/v1/graph') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  public static getInstance(baseUrl?: string): DeveloperGraphClient {
    if (!DeveloperGraphClient.instance) {
      DeveloperGraphClient.instance = new DeveloperGraphClient(baseUrl);
    }
    return DeveloperGraphClient.instance;
  }

  public static resetInstance(): void {
    DeveloperGraphClient.instance = null;
  }

  async getPeerRecommendations(
    developerId: string,
    limit: number = 10,
  ): Promise<PeerRecommendation[]> {
    const url = `${this.baseUrl}/recommendations/peers/${encodeURIComponent(developerId)}?limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch peer recommendations: HTTP ${res.status}`);
    }
    return res.json();
  }

  async getMentorRecommendations(
    developerId: string,
    skill?: string,
    limit: number = 10,
  ): Promise<MentorRecommendation[]> {
    let url = `${this.baseUrl}/recommendations/mentors/${encodeURIComponent(developerId)}?limit=${limit}`;
    if (skill) {
      url += `&skill=${encodeURIComponent(skill)}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch mentor recommendations: HTTP ${res.status}`);
    }
    return res.json();
  }

  async getProjectRecommendations(
    developerId: string,
    limit: number = 10,
  ): Promise<ProjectRecommendation[]> {
    const url = `${this.baseUrl}/recommendations/projects/${encodeURIComponent(developerId)}?limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch project recommendations: HTTP ${res.status}`);
    }
    return res.json();
  }

  async traverseNetwork(
    developerId: string,
    maxDegree: number = 4,
  ): Promise<GraphTraversalBenchmark> {
    const url = `${this.baseUrl}/traversal/${encodeURIComponent(developerId)}?maxDegree=${maxDegree}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to execute graph traversal: HTTP ${res.status}`);
    }
    return res.json();
  }

  async computePageRank(
    dampingFactor: number = 0.85,
    iterations: number = 20,
  ): Promise<Array<{ developerId: string; username: string; rank: number }>> {
    const url = `${this.baseUrl}/pagerank?dampingFactor=${dampingFactor}&iterations=${iterations}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to compute PageRank: HTTP ${res.status}`);
    }
    return res.json();
  }
}

