export interface ScheduledTournament {
  id: string;
  name: string;
  startTimeMs: number;
  problemIds: string[];
  registeredUserIds: string[];
}

export class EphemeralCachePrewarmerService {
  private cache = new Map<string, { value: any; expiresAt: number }>();
  private prewarmWindowMs: number;

  constructor(prewarmWindowMinutes: number = 5) {
    this.prewarmWindowMs = prewarmWindowMinutes * 60 * 1000;
  }

  public shouldPrewarm(tournament: ScheduledTournament, currentTimeMs: number = Date.now()): boolean {
    const diff = tournament.startTimeMs - currentTimeMs;
    return diff > 0 && diff <= this.prewarmWindowMs;
  }

  public async prewarmTournament(
    tournament: ScheduledTournament,
    problemLoader: (id: string) => Promise<any>,
    ttlSeconds: number = 3600
  ): Promise<{ cachedProblems: number; prewarmed: boolean }> {
    let cachedCount = 0;
    const expiresAt = Date.now() + ttlSeconds * 1000;

    for (const probId of tournament.problemIds) {
      const data = await problemLoader(probId);
      this.cache.set(`tournament:${tournament.id}:problem:${probId}`, { value: data, expiresAt });
      cachedCount++;
    }

    this.cache.set(`tournament:${tournament.id}:roster`, {
      value: tournament.registeredUserIds,
      expiresAt
    });

    return { cachedProblems: cachedCount, prewarmed: true };
  }

  public getCached(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }
}
