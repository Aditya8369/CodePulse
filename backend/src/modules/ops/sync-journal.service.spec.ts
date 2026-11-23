import { SyncJournalService } from './sync-journal.service';

describe('SyncJournalService', () => {
  let journal: SyncJournalService;

  beforeEach(() => {
    journal = new SyncJournalService({ localRegion: 'AWS_US_EAST', maxJournalRetained: 1000 });
  });

  afterEach(() => {
    journal.onModuleDestroy();
  });

  it('should initialize with AWS_US_EAST and monotonic LSN starting at 0n', () => {
    expect(journal.getLocalRegion()).toBe('AWS_US_EAST');
    expect(journal.getCurrentLsn()).toBe(0n);
  });

  it('should append log entries with monotonic LSN and SHA256 checksum', () => {
    const entry1 = journal.append('user:1:profile', 'INSERT', { name: 'Alice' }, 'uuid-1', { AWS_US_EAST: 1 });
    expect(entry1.lsn).toBe(1n);
    expect(entry1.checksum).toBeDefined();
    expect(entry1.checksum.length).toBe(16);

    const entry2 = journal.append('user:1:profile', 'UPDATE', { name: 'Alice Smith' }, 'uuid-2', { AWS_US_EAST: 2 });
    expect(entry2.lsn).toBe(2n);
    expect(journal.getCurrentLsn()).toBe(2n);
  });

  it('should create incremental replication batch for peer GCP region', () => {
    journal.append('doc:alpha', 'INSERT', { content: 'v1' }, 'u-1', { AWS_US_EAST: 1 });
    journal.append('doc:beta', 'INSERT', { content: 'v1' }, 'u-2', { AWS_US_EAST: 2 });

    const batch = journal.getReplicationBatch('GCP_EU_CENTRAL');
    expect(batch.entries.length).toBe(2);
    expect(batch.sourceRegion).toBe('AWS_US_EAST');
    expect(batch.targetRegion).toBe('GCP_EU_CENTRAL');
  });

  it('should advance checkpoint upon LSN acknowledgment and calculate replication lag', () => {
    const pastTime = Date.now() - 60;
    journal.append('doc:gamma', 'INSERT', { content: 'v1' }, 'u-3', { AWS_US_EAST: 3 }, pastTime);

    journal.acknowledgeLsn('GCP_EU_CENTRAL', 1n);

    const metrics = journal.getMetrics();
    const gcpCp = metrics.checkpoints['GCP_EU_CENTRAL'];
    expect(gcpCp.acknowledgedLsn).toBe(1n);
    expect(gcpCp.lagMs).toBeGreaterThanOrEqual(50);
  });

  it('should flag SLA breach if replication lag exceeds 250ms benchmark', () => {
    const laggingTimestamp = Date.now() - 350; // 350ms ago > 250ms SLA
    journal.append('doc:delta', 'INSERT', { content: 'v1' }, 'u-4', { AWS_US_EAST: 4 }, laggingTimestamp);

    journal.acknowledgeLsn('GCP_EU_CENTRAL', 1n);

    const metrics = journal.getMetrics();
    expect(metrics.slaBreachCount).toBeGreaterThanOrEqual(1);
  });

  it('should replay unacknowledged journal delta after cloud reconnect', () => {
    journal.append('item:1', 'INSERT', 'val1', 'id-1', {});
    journal.append('item:2', 'INSERT', 'val2', 'id-2', {});
    journal.acknowledgeLsn('GCP_EU_CENTRAL', 1n);

    // After reconnect, replay should deliver entry 2
    const replayBatch = journal.replayForReconnect('GCP_EU_CENTRAL');
    expect(replayBatch.entries.length).toBe(1);
    expect(replayBatch.entries[0].key).toBe('item:2');
  });
});
