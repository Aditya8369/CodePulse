import { ServiceUnavailableException } from '@nestjs/common';
import { QuorumWitnessService } from './quorum-witness.service';

describe('QuorumWitnessService (Automatic Split-Brain Resolution)', () => {
  let service: QuorumWitnessService;

  beforeEach(() => {
    service = new QuorumWitnessService(undefined, { totalExpectedNodes: 3 });
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should initialize with correct quorum threshold (2 of 3)', () => {
    expect(service.getQuorumThreshold()).toBe(2);
    expect(service.getClusterMode()).toBe('READ_ONLY_SAFE_MODE'); // only self initially (1 < 2)
  });

  it('should transition to READ_WRITE mode when majority quorum achieved', () => {
    service.updateActivePeers([service.getNodeId(), 'pod-2']);
    expect(service.hasQuorum()).toBe(true);
    expect(service.getClusterMode()).toBe('READ_WRITE');
  });

  it('should transition to READ_ONLY_SAFE_MODE when partitioned into minority', () => {
    // 3 pods cluster, but this partition can only see itself
    service.updateActivePeers([service.getNodeId()]);
    expect(service.hasQuorum()).toBe(false);
    expect(service.getClusterMode()).toBe('READ_ONLY_SAFE_MODE');
  });

  it('should throw ServiceUnavailableException (503) when mutation attempted in minority partition', () => {
    service.updateActivePeers([service.getNodeId()]);
    expect(() => service.assertMutationAllowed()).toThrow(ServiceUnavailableException);
  });

  it('should allow mutation when majority quorum achieved', () => {
    service.updateActivePeers([service.getNodeId(), 'pod-2', 'pod-3']);
    expect(() => service.assertMutationAllowed()).not.toThrow();
  });

  it('should enter READ_ONLY_SAFE_MODE if witness node is unreachable even with local peers', () => {
    service.updateActivePeers([service.getNodeId(), 'pod-2']);
    expect(service.hasQuorum()).toBe(true);

    service.setWitnessReachable(false);
    expect(service.hasQuorum()).toBe(false);
    expect(service.getClusterMode()).toBe('READ_ONLY_SAFE_MODE');
    expect(() => service.assertMutationAllowed()).toThrow(ServiceUnavailableException);
  });

  it('should restore READ_WRITE mode when network partition heals', () => {
    // Partition occurs
    service.updateActivePeers([service.getNodeId()]);
    expect(service.getClusterMode()).toBe('READ_ONLY_SAFE_MODE');

    // Partition heals
    service.updateActivePeers([service.getNodeId(), 'pod-2']);
    expect(service.getClusterMode()).toBe('READ_WRITE');
    expect(() => service.assertMutationAllowed()).not.toThrow();
  });

  it('correctly reports cluster status', () => {
    service.updateActivePeers([service.getNodeId(), 'pod-2']);
    const status = service.getStatus();
    expect(status.reachableNodes).toBe(2);
    expect(status.totalConfiguredNodes).toBe(3);
    expect(status.quorumThreshold).toBe(2);
    expect(status.hasQuorum).toBe(true);
    expect(status.clusterMode).toBe('READ_WRITE');
  });
});
