import { PgHaFailoverCoordinatorService } from './pg-ha-failover-coordinator.service';

describe('PgHaFailoverCoordinatorService', () => {
  let coordinator: PgHaFailoverCoordinatorService;

  beforeEach(() => {
    coordinator = new PgHaFailoverCoordinatorService();
  });

  afterEach(() => {
    coordinator.onModuleDestroy();
  });

  it('should promote synchronous standby with zero data loss upon primary failure', () => {
    coordinator.registerNode({
      nodeId: 'pg-primary-us-east',
      region: 'us-east-1',
      endpoint: '10.0.1.10:5432',
      role: 'PRIMARY',
      replicationLagBytes: 0,
      isHealthy: true,
      lastHeartbeatAt: Date.now(),
    });

    coordinator.registerNode({
      nodeId: 'pg-standby-us-east-b',
      region: 'us-east-1',
      endpoint: '10.0.1.11:5432',
      role: 'STANDBY_SYNC',
      replicationLagBytes: 0,
      isHealthy: true,
      lastHeartbeatAt: Date.now(),
    });

    const event = coordinator.triggerAutomaticFailover('Healthcheck timeout');
    expect(event).not.toBeNull();
    expect(event?.newPrimaryId).toBe('pg-standby-us-east-b');
    expect(event?.dataLossZero).toBe(true);
    expect(coordinator.getActivePrimary()?.nodeId).toBe('pg-standby-us-east-b');
  });
});
