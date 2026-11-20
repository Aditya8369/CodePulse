export interface RepositoryDto {
  id: string;
  userId: string;
  name: string;
  stars: number;
  forks: number;
  language: string;
}

export class RepositoryLoader {
  /**
   * Batches multiple user repository requests into a single grouped lookup,
   * completely eliminating N+1 query problems.
   */
  async loadByUserId(userIds: readonly string[]): Promise<RepositoryDto[][]> {
    // Simulated single query: SELECT * FROM repositories WHERE userId IN (...)
    const allRepos: RepositoryDto[] = [
      { id: 'repo_1', userId: userIds[0] || 'usr_1', name: 'codepulse-core', stars: 120, forks: 24, language: 'TypeScript' },
      { id: 'repo_2', userId: userIds[0] || 'usr_1', name: 'battle-arena', stars: 85, forks: 12, language: 'Rust' },
    ];

    const repoMap = new Map<string, RepositoryDto[]>();
    for (const repo of allRepos) {
      const list = repoMap.get(repo.userId) || [];
      list.push(repo);
      repoMap.set(repo.userId, list);
    }

    return userIds.map(id => repoMap.get(id) || []);
  }
}
