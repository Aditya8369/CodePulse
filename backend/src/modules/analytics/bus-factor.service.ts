import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { createHash } from 'node:crypto';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import {
  analyzeAuthorship,
  type AuthorshipCommit,
  type FileChange,
} from './authorship';

interface CommitSummary {
  sha: string;
}
interface CommitDetail {
  author?: { login?: string } | null;
  commit?: { author?: { email?: string; name?: string } };
  parents?: { sha: string }[];
  files?: FileChange[];
}
type Report = ReturnType<typeof analyzeAuthorship> & {
  repositoryId: string;
  sampledCommits: number;
  partial: boolean;
  methodology: string;
};
const LIMIT = 50;

@Injectable()
export class BusFactorService {
  private readonly inflight = new Map<string, Promise<Report>>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getReport(userId: string, repositoryId: string): Promise<Report> {
    // Always authorize before cache lookup; a shared report never bypasses ownership.
    const repo = await this.prisma.repository.findFirst({
      where: { id: repositoryId, userId },
    });
    if (!repo) throw new NotFoundException('Repository not found');
    if (repo.isPrivate)
      throw new UnprocessableEntityException(
        'Authorship analysis currently supports public repositories only',
      );
    const parts = repo.fullName.split('/');
    if (
      parts.length !== 2 ||
      parts.some((p) => !/^[\w.-]+$/.test(p) || p === '.' || p === '..')
    ) {
      throw new BadRequestException('Invalid repository name');
    }
    const key = `analytics:bus-factor:v1:${repositoryId}:${repo.fullName}`;
    const cached = await this.cache.get<Report>(key);
    if (cached) return cached;
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const task = this.collect(repositoryId, parts)
      .then(async (report) => {
        await this.cache.set(key, report, 15 * 60 * 1000);
        return report;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, task);
    return task;
  }

  private async collect(
    repositoryId: string,
    parts: string[],
  ): Promise<Report> {
    const token = this.config.get<string>('GITHUB_TOKEN');
    const options = {
      timeout: 10000,
      maxContentLength: 4 * 1024 * 1024,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'CodePulse-Developer-Platform',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const base = `https://api.github.com/repos/${parts.map(encodeURIComponent).join('/')}`;
    const commits: AuthorshipCommit[] = [];
    let partial = false;
    try {
      let summaries: CommitSummary[];
      try {
        const response = await axios.get<CommitSummary[]>(`${base}/commits`, {
          ...options,
          params: { per_page: LIMIT },
        });
        summaries = response.data;
        partial =
          Boolean(response.headers?.link?.includes('rel="next"')) ||
          summaries.length === LIMIT;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409)
          summaries = [];
        else throw error;
      }
      if (!Array.isArray(summaries)) throw new Error('Invalid commit list');
      const seen = new Set<string>();
      // Reverse GitHub's newest-first response to replay file creation/renames/deletion.
      for (const summary of summaries.slice(0, LIMIT).reverse()) {
        if (!/^[0-9a-f]{40}$/i.test(summary.sha))
          throw new Error('Invalid commit id');
        if (seen.has(summary.sha)) continue;
        seen.add(summary.sha);
        const response = await axios.get<CommitDetail>(
          `${base}/commits/${summary.sha}`,
          options,
        );
        const detail = response.data;
        if (!Array.isArray(detail.files) || !Array.isArray(detail.parents))
          throw new Error('Incomplete commit');
        // GitHub paginates files at 300. Report incomplete evidence explicitly.
        if (
          response.headers?.link?.includes('rel="next"') ||
          detail.files.length >= 300
        )
          partial = true;
        if (detail.parents.length > 1) continue; // Avoid attributing merge diffs twice.
        const identity =
          detail.author?.login?.toLowerCase() ??
          `unlinked-${createHash('sha256')
            .update(
              detail.commit?.author?.email?.trim().toLowerCase() ||
                detail.commit?.author?.name ||
                summary.sha,
            )
            .digest('hex')
            .slice(0, 16)}`;
        if (!detail.author?.login && !detail.commit?.author?.email)
          partial = true;
        if (
          detail.files.some(
            (f) =>
              typeof f.filename !== 'string' || typeof f.status !== 'string',
          )
        )
          throw new Error('Invalid file trace');
        commits.push({
          sha: summary.sha,
          author: identity,
          files: detail.files,
        });
      }
    } catch {
      throw new BadGatewayException(
        'Could not load complete requested GitHub history; retry later',
      );
    }
    const analysis = analyzeAuthorship(commits);
    partial ||= analysis.firstAuthorshipUnknown > 0;
    return {
      repositoryId,
      ...analysis,
      sampledCommits: commits.length,
      partial,
      methodology:
        'DOA estimate over at most 50 recent non-merge commits and observed files; not a full-repository knowledge assessment. Score caps the estimated bus factor at 10. Entropy/Gini summarize authorship concentration. Rename history is preserved within the sample; removed files are excluded.',
    };
  }
}
