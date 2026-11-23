import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EntityDataLoader } from '../../graphql/federation-gateway';

export interface RepositoryEntity {
  id: string;
  githubRepoId: string;
  userId: string;
  name: string;
  fullName: string;
  stars: number;
  forks: number;
  commits: number;
  language: string | null;
  url: string;
}

@Injectable()
export class RepositoryResolver {
  private readonly reposByUserLoader: EntityDataLoader<string, RepositoryEntity[]>;

  constructor(@Optional() private readonly prisma?: PrismaService) {
    this.reposByUserLoader = new EntityDataLoader<string, RepositoryEntity[]>(
      async (userIds: readonly string[]) => {
        if (!this.prisma) {
          return userIds.map(() => []);
        }
        const repos = await this.prisma.repository.findMany({
          where: { userId: { in: [...userIds] } },
          orderBy: { stars: 'desc' },
        });

        const map = new Map<string, RepositoryEntity[]>();
        for (const uid of userIds) {
          map.set(uid, []);
        }
        for (const r of repos) {
          map.get(r.userId)?.push(r as unknown as RepositoryEntity);
        }
        return userIds.map((uid) => map.get(uid) ?? []);
      },
    );
  }

  async repositoriesForUser(userId: string, limit = 10): Promise<RepositoryEntity[]> {
    const repos = await this.reposByUserLoader.load(userId);
    return repos.slice(0, limit);
  }
}
