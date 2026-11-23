import { SessionConsistencyRouterService } from './session-consistency.service';

describe('SessionConsistencyRouterService', () => {
  let router: SessionConsistencyRouterService;

  beforeEach(() => {
    router = new SessionConsistencyRouterService({
      consistencyWindowMs: 500,
      maxReplicaLagToleranceMs: 50,
    });
  });

  afterEach(() => {
    router.onModuleDestroy();
  });

  it('should route normal reads to READ_REPLICA', () => {
    const decision = router.routeQuery('user-1');
    expect(decision.target).toBe('READ_REPLICA');
    expect(decision.reason).toBe('HEALTHY_REPLICA_READ');
  });

  it('should route to PRIMARY when user has recently mutated state (Read-Your-Own-Writes)', () => {
    router.recordUserMutation('user-2', 'UPDATE_PROFILE');

    const decision = router.routeQuery('user-2');
    expect(decision.target).toBe('PRIMARY');
    expect(decision.reason).toBe('RECENT_USER_MUTATION');
  });

  it('should route to PRIMARY when replica lag exceeds tolerance threshold', () => {
    router.setReplicaLag(80); // 80ms > 50ms tolerance

    const decision = router.routeQuery('user-3');
    expect(decision.target).toBe('PRIMARY');
    expect(decision.reason).toBe('REPLICA_LAG_EXCEEDED');
  });

  it('should revert back to READ_REPLICA once user mutation window expires', async () => {
    router.recordUserMutation('user-4', 'BATTLE_FINISH');
    expect(router.routeQuery('user-4').target).toBe('PRIMARY');

    await new Promise((r) => setTimeout(r, 550)); // window was 500ms
    expect(router.routeQuery('user-4').target).toBe('READ_REPLICA');
  });
});
