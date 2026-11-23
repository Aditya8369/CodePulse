import { DistributedLeaderElectionService } from './leader-election.service';

describe('DistributedLeaderElectionService', () => {
  let service: DistributedLeaderElectionService;

  beforeEach(() => {
    service = new DistributedLeaderElectionService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should acquire leadership when no leader exists', async () => {
    const acquired = await service.acquireLeadership('tourney-1', 'pod-a');
    expect(acquired).toBe(true);
    expect(service.isLeader('tourney-1', 'pod-a')).toBe(true);
  });

  it('should prevent other pods from acquiring leadership while held', async () => {
    await service.acquireLeadership('tourney-1', 'pod-a');
    const competitorAcquired = await service.acquireLeadership('tourney-1', 'pod-b');
    expect(competitorAcquired).toBe(false);
    expect(service.isLeader('tourney-1', 'pod-b')).toBe(false);
  });

  it('should re-grant leadership to the same pod idempotently', async () => {
    await service.acquireLeadership('tourney-1', 'pod-a');
    const reacquired = await service.acquireLeadership('tourney-1', 'pod-a');
    expect(reacquired).toBe(true);
  });

  it('should allow another pod to acquire after leader gracefully resigns', async () => {
    await service.acquireLeadership('tourney-1', 'pod-a');
    await service.resignLeadership('tourney-1', 'pod-a');
    expect(service.isLeader('tourney-1', 'pod-a')).toBe(false);

    const podBAcquired = await service.acquireLeadership('tourney-1', 'pod-b');
    expect(podBAcquired).toBe(true);
    expect(service.isLeader('tourney-1', 'pod-b')).toBe(true);
  });

  it('should safely advance bracket only if leader', async () => {
    await service.acquireLeadership('tourney-1', 'pod-a');

    let executed = false;
    const resultA = await service.advanceBracketSafely('tourney-1', 'pod-a', async () => {
      executed = true;
      return { advancedRound: 2 };
    });

    expect(resultA.executed).toBe(true);
    expect(resultA.result?.advancedRound).toBe(2);
    expect(executed).toBe(true);

    const resultB = await service.advanceBracketSafely('tourney-1', 'pod-b', async () => {
      return { advancedRound: 3 };
    });

    expect(resultB.executed).toBe(false);
    expect(resultB.result).toBeUndefined();
  });
});
