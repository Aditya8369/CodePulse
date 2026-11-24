import { DbConnectionGuardService } from './db-connection-guard.service';

describe('DbConnectionGuardService', () => {
  let guard: DbConnectionGuardService;

  beforeEach(() => {
    guard = new DbConnectionGuardService(2); // Small connection pool (max 2) for testing
  });

  it('should execute queries immediately when pool is below limit', async () => {
    const res = await guard.executeGuardedQuery('CRITICAL', async () => 'tx_ok');
    expect(res).toBe('tx_ok');
    expect(guard.getStats().totalServed).toBe(1);
  });

  it('should prioritize USER_FACING queries over BACKGROUND_ANALYTICS queries', async () => {
    const executionOrder: string[] = [];

    // Occupy 2 connections
    const blocker1 = guard.executeGuardedQuery('CRITICAL', () => new Promise((r) => setTimeout(r, 50)));
    const blocker2 = guard.executeGuardedQuery('CRITICAL', () => new Promise((r) => setTimeout(r, 50)));

    // Queue 1 background query first, then 1 user facing query
    const bgQuery = guard.executeGuardedQuery('BACKGROUND_ANALYTICS', async () => {
      executionOrder.push('BACKGROUND');
      return 'bg_done';
    });

    const userQuery = guard.executeGuardedQuery('USER_FACING', async () => {
      executionOrder.push('USER_FACING');
      return 'user_done';
    });

    await Promise.all([blocker1, blocker2, bgQuery, userQuery]);

    // USER_FACING must be executed before BACKGROUND even though BACKGROUND was enqueued first
    expect(executionOrder[0]).toBe('USER_FACING');
    expect(executionOrder[1]).toBe('BACKGROUND');
  });

  it('should prevent pool timeout under concurrent burst requests', async () => {
    guard.setMaxConnections(5);
    const promises: Promise<number>[] = [];

    for (let i = 0; i < 20; i++) {
      promises.push(
        guard.executeGuardedQuery('USER_FACING', async () => {
          await new Promise((r) => setTimeout(r, 10));
          return i;
        }),
      );
    }

    const results = await Promise.all(promises);
    expect(results.length).toBe(20);
    expect(guard.getStats().totalServed).toBe(20);
  });
});
