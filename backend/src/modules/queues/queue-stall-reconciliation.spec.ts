import { QueueStallReconciliationService } from './queue-stall-reconciliation.service';

describe('QueueStallReconciliationService', () => {
  let reconciler: QueueStallReconciliationService;

  beforeEach(() => {
    reconciler = new QueueStallReconciliationService(1000); // 1s stall TTL for rapid testing
  });

  afterEach(() => {
    reconciler.onModuleDestroy();
  });

  it('should track active jobs and accept heartbeats', () => {
    reconciler.registerActiveJob('job-1', 'sync', { repo: 'CodePulse' });
    expect(reconciler.getTrackedCount()).toBe(1);

    reconciler.heartbeat('job-1');
    expect(reconciler.getTrackedCount()).toBe(1);

    reconciler.markCompleted('job-1');
    expect(reconciler.getTrackedCount()).toBe(0);
  });

  it('should detect stalled jobs exceeding heartbeat TTL', () => {
    const job = reconciler.registerActiveJob('job-stalled', 'analysis', { file: 'index.ts' });
    job.lastHeartbeatTime = Date.now() - 2000; // 2 seconds ago (> 1s TTL)

    const reaped = reconciler.reconcileStalledJobs();
    expect(reaped.length).toBe(1);
    expect(reaped[0].state).toBe('stalled');
    expect(reaped[0].failureCount).toBe(1);
  });

  it('should route permanently stalled jobs to DLQ after 3 failures and allow redrive', () => {
    const job = reconciler.registerActiveJob('job-poison', 'webhooks', { payload: {} });
    job.lastHeartbeatTime = Date.now() - 2000;

    // Failure 1
    reconciler.reconcileStalledJobs();
    job.state = 'active';
    job.lastHeartbeatTime = Date.now() - 2000;

    // Failure 2
    reconciler.reconcileStalledJobs();
    job.state = 'active';
    job.lastHeartbeatTime = Date.now() - 2000;

    // Failure 3 -> should move to DLQ
    reconciler.reconcileStalledJobs();

    expect(reconciler.getDlqCount()).toBe(1);
    expect(reconciler.getTrackedCount()).toBe(0);

    const diagnostics = reconciler.inspectDlq();
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].jobId).toBe('job-poison');

    // Redrive job
    const redriven = reconciler.redriveDlqJob('job-poison');
    expect(redriven).toBe(true);
    expect(reconciler.getDlqCount()).toBe(0);
    expect(reconciler.getTrackedCount()).toBe(1);
  });
});
