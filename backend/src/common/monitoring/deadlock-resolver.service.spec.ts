import { DeadlockResolverService } from './deadlock-resolver.service';

describe('DeadlockResolverService (Tarjan SCC Cycle Detection, Victim Selection & Jitter Retry)', () => {
  let resolver: DeadlockResolverService;

  beforeEach(() => {
    resolver = new DeadlockResolverService();
  });

  it('detects cyclical lock wait graphs using Tarjan SCC and aborts lowest-cost victim in < 500ms', async () => {
    const terminatedPids: number[] = [];

    const resolutions = await resolver.resolvePostgreSqlDeadlocks(
      [
        {
          blockedPid: 101,
          blockedQuery: 'UPDATE users SET xp = xp + 50 WHERE id = $1',
          blockedModifiedRows: 1,
          blockedQueryCost: 12,
          blockingPid: 102,
          blockingQuery: 'UPDATE tournament_matches SET winner_id = $1 WHERE id = $2',
          blockingModifiedRows: 8,
          blockingQueryCost: 95,
          relationName: 'tournament_matches',
          lockMode: 'RowExclusiveLock',
        },
        {
          blockedPid: 102,
          blockedQuery: 'UPDATE tournament_matches SET winner_id = $1 WHERE id = $2',
          blockedModifiedRows: 8,
          blockedQueryCost: 95,
          blockingPid: 101,
          blockingQuery: 'UPDATE users SET xp = xp + 50 WHERE id = $1',
          blockingModifiedRows: 1,
          blockingQueryCost: 12,
          relationName: 'users',
          lockMode: 'RowExclusiveLock',
        },
      ],
      async (pid) => {
        terminatedPids.push(pid);
        return true;
      },
    );

    expect(resolutions).toHaveLength(1);
    expect(resolutions[0].victim.pid).toBe(101); // Lowest modifiedRows (1 vs 8)
    expect(terminatedPids).toEqual([101]);
    expect(resolutions[0].resolutionDurationMs).toBeLessThan(500);
    expect(resolutions[0].conflictingQueries).toHaveLength(2);
  });

  it('recovers concurrent conflicting transactions via full-jitter retry and fires Prometheus alert at >5/min', async () => {
    let attempts = 0;

    const result = await resolver.executeWithDeadlockRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          const err: any = new Error('deadlock detected');
          err.code = '40P01';
          throw err;
        }
        return { committed: true, attempts };
      },
      { baseDelayMs: 2, maxDelayMs: 10, operationName: 'match_conclusion_tx' },
    );

    expect(result).toEqual({ committed: true, attempts: 3 });

    // Trigger 4 more deadlocks -> total 6 in rolling 60s window (> 5/min threshold)
    for (let i = 0; i < 4; i++) {
      await resolver.resolvePostgreSqlDeadlocks([
        {
          blockedPid: 200 + i,
          blockedQuery: 'UPDATE leaderboard SET rank = 1',
          blockingPid: 300 + i,
          blockingQuery: 'UPDATE leaderboard SET rank = 2',
        },
        {
          blockedPid: 300 + i,
          blockedQuery: 'UPDATE leaderboard SET rank = 2',
          blockingPid: 200 + i,
          blockingQuery: 'UPDATE leaderboard SET rank = 1',
        },
      ]);
    }

    expect(resolver.isAlertTriggered()).toBe(true);
    const prom = resolver.getPrometheusMetrics();
    expect(prom).toContain('codepulse_db_deadlock_alert_active 1');
  });
});
