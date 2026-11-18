import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { normalize, recommendTech, type Vector } from './tech-graph';

const TTL = 7 * 24 * 60 * 60 * 1000;
type Response = {
  recommendations: ReturnType<typeof recommendTech>;
  evidence: Vector;
  sampledRepositories: number;
  partial: boolean;
  methodology: string;
};

@Injectable()
export class RecommendationsService {
  private readonly inflight = new Map<string, Promise<Response>>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getTechStack(userId: string): Promise<Response> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
    // Private source is never sent to a shared GitHub service token.
    const repos = await this.prisma.repository.findMany({
      where: { userId, isPrivate: false, archivedAt: null },
      orderBy: [{ repoUpdatedAt: 'desc' }, { id: 'asc' }],
      take: 11,
      select: { id: true, fullName: true, commits: true, repoUpdatedAt: true },
    });
    const revision = repos
      .map((r) => `${r.id}:${r.repoUpdatedAt.toISOString()}:${r.commits}`)
      .join('|');
    const key = `recommendations:tech:v1:${userId}:${revision}`;
    const cached = await this.cache.get<Response>(key);
    if (cached) return cached;
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const job = this.compute(userId, repos)
      .then(async (result) => {
        await this.cache.set(key, result, TTL);
        return result;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, job);
    return job;
  }

  private async compute(
    userId: string,
    repos: { fullName: string; commits: number }[],
  ): Promise<Response> {
    const evidence: Vector = Object.create(null);
    let partial = repos.length > 10;
    let sampledRepositories = 0;
    const token = this.config.get<string>('GITHUB_TOKEN');
    for (const repo of repos.slice(0, 10)) {
      const parts = repo.fullName.split('/');
      if (
        parts.length !== 2 ||
        parts.some((p) => !/^[\w.-]+$/.test(p) || p === '.' || p === '..')
      ) {
        partial = true;
        continue;
      }
      let bytes: Vector;
      try {
        const response = await axios.get<Vector>(
          `https://api.github.com/repos/${parts.map(encodeURIComponent).join('/')}/languages`,
          {
            timeout: 10000,
            maxContentLength: 1024 * 1024,
            headers: {
              Accept: 'application/vnd.github+json',
              'User-Agent': 'CodePulse-Developer-Platform',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
        );
        bytes = response.data;
        if (
          !bytes ||
          typeof bytes !== 'object' ||
          Array.isArray(bytes) ||
          Object.values(bytes).some(
            (n) => typeof n !== 'number' || !Number.isFinite(n) || n < 0,
          )
        )
          throw new Error('Invalid language response');
      } catch {
        // Never cache fabricated recommendations on upstream failure.
        throw new BadGatewayException(
          'Could not load language evidence; retry later',
        );
      }
      const weight = 1 + Math.log1p(Math.max(0, repo.commits));
      for (const [language, fraction] of Object.entries(normalize(bytes))) {
        evidence[language] = (evidence[language] ?? 0) + fraction * weight;
      }
      sampledRepositories++;
    }
    // Only aggregate public repository records. No peer identities are returned.
    const peerRepos = await this.prisma.repository.findMany({
      where: {
        userId: { not: userId },
        isPrivate: false,
        archivedAt: null,
        user: { deletedAt: null },
      },
      take: 1001,
      orderBy: [{ userId: 'asc' }, { id: 'asc' }],
      select: { userId: true, language: true, commits: true },
    });
    partial ||= peerRepos.length > 1000;
    const peerVectors = new Map<string, Vector>();
    for (const repo of peerRepos.slice(0, 1000)) {
      if (!repo.language) continue;
      if (!peerVectors.has(repo.userId))
        peerVectors.set(repo.userId, Object.create(null) as Vector);
      const vector = peerVectors.get(repo.userId)!;
      vector[repo.language] =
        (vector[repo.language] ?? 0) +
        1 +
        Math.log1p(Math.max(0, repo.commits));
    }
    const mastery = normalize(evidence);
    return {
      recommendations: recommendTech(mastery, [...peerVectors.values()]),
      evidence: mastery,
      sampledRepositories,
      partial,
      methodology:
        'Heuristic progression suggestions, not measured proficiency or labor-market demand. Own evidence uses GitHub language-byte fractions weighted by log commit counts across up to 10 public repositories. Collaborative evidence aggregates primary-language co-occurrence across up to 1,000 public peer records. Practice hours are illustrative planning estimates, not a guarantee. Cache TTL: seven days; repository updates change the cache key.',
    };
  }
}
