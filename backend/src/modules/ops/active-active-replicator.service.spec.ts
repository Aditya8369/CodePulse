import { ActiveActiveReplicatorService } from './active-active-replicator.service';

describe('ActiveActiveReplicatorService', () => {
  let awsReplicator: ActiveActiveReplicatorService;
  let gcpReplicator: ActiveActiveReplicatorService;

  beforeEach(() => {
    awsReplicator = new ActiveActiveReplicatorService('AWS_US_EAST');
    gcpReplicator = new ActiveActiveReplicatorService('GCP_EU_CENTRAL');
  });

  describe('UUIDv7 Primary Key Generation', () => {
    it('generates strictly ordered UUIDv7 with correct version and variant', () => {
      const t1 = 1700000000000;
      const t2 = 1700000001000;
      const id1 = awsReplicator.generateUUIDv7(t1);
      const id2 = awsReplicator.generateUUIDv7(t2);

      expect(id1.charAt(14)).toBe('7'); // Version 7
      expect(['8', '9', 'a', 'b']).toContain(id1.charAt(19).toLowerCase()); // Variant
      expect(id1.localeCompare(id2)).toBeLessThan(0); // Chronological ordering
    });
  });

  describe('Last-Write-Wins Conflict Resolution', () => {
    it('resolves concurrent updates in favor of higher NTP timestamp', () => {
      const updateAws = awsReplicator.updateLocal('user:101:settings', { theme: 'cyberpunk' }, 1000);
      const updateGcp = gcpReplicator.updateLocal('user:101:settings', { theme: 'matrix-green' }, 1050);

      // Replicate AWS to GCP
      const res1 = gcpReplicator.replicateIncoming(updateAws);
      expect(res1.appliedRecord.value).toEqual({ theme: 'matrix-green' }); // GCP was newer (1050 > 1000)

      // Replicate GCP to AWS
      const res2 = awsReplicator.replicateIncoming(updateGcp);
      expect(res2.appliedRecord.value).toEqual({ theme: 'matrix-green' }); // GCP wins on AWS too

      // Both converge to identical state
      expect(awsReplicator.getRecord('user:101:settings')?.value).toEqual(
        gcpReplicator.getRecord('user:101:settings')?.value,
      );
    });

    it('resolves simultaneous updates within 500ms converging both regions', () => {
      const now = Date.now();
      const awsRecord = awsReplicator.updateLocal('user:202:flags', { betaFeatures: true }, now);
      const gcpRecord = gcpReplicator.updateLocal('user:202:flags', { betaFeatures: false }, now + 5);

      // Simulate bi-directional sync within 50ms
      awsReplicator.replicateIncoming(gcpRecord);
      gcpReplicator.replicateIncoming(awsRecord);

      expect(awsReplicator.getRecord('user:202:flags')?.value).toEqual({ betaFeatures: false });
      expect(gcpReplicator.getRecord('user:202:flags')?.value).toEqual({ betaFeatures: false });
    });
  });

  describe('Prometheus Telemetry', () => {
    it('exposes replication lag gauge metric', () => {
      const olderTime = Date.now() - 45;
      const record = awsReplicator.updateLocal('test:metric', 'value', olderTime);
      gcpReplicator.replicateIncoming(record);

      expect(gcpReplicator.getReplicationLagMs()).toBeGreaterThanOrEqual(40);
      const metrics = gcpReplicator.getPrometheusMetrics();
      expect(metrics).toContain('codepulse_active_active_replication_lag_ms');
      expect(metrics).toContain('region="GCP_EU_CENTRAL"');
    });
  });
});
