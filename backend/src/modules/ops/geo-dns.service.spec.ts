import { GeoDnsService } from './geo-dns.service';

describe('GeoDnsService (#1054)', () => {
  let service: GeoDnsService;

  beforeEach(() => {
    service = new GeoDnsService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('routes Indian client queries to AP-South (Mumbai) with ping under 35ms', () => {
    const resolution = service.resolveDns({ countryCode: 'IN' });

    expect(resolution.selectedPop.id).toBe('ap-south-1');
    expect(resolution.resolvedIp).toBe('13.232.0.1');
    expect(resolution.estimatedRttMs).toBeLessThanOrEqual(35);
    expect(resolution.isFailover).toBe(false);
  });

  it('routes Indian IP blocks (e.g. 103.x) to AP-South', () => {
    const resolution = service.resolveDns('103.21.244.1');

    expect(resolution.selectedPop.id).toBe('ap-south-1');
    expect(resolution.estimatedRttMs).toBeLessThanOrEqual(35);
  });

  it('routes European client queries to EU-Central (Frankfurt)', () => {
    const resolution = service.resolveDns({ countryCode: 'DE' });

    expect(resolution.selectedPop.id).toBe('eu-central-1');
    expect(resolution.resolvedIp).toBe('18.194.0.1');
    expect(resolution.isFailover).toBe(false);
  });

  it('routes North American queries to US-East (N. Virginia)', () => {
    const resolution = service.resolveDns({ countryCode: 'US' });

    expect(resolution.selectedPop.id).toBe('us-east-1');
    expect(resolution.resolvedIp).toBe('3.80.0.1');
  });

  it('automatically reroutes traffic if primary edge POP experiences high packet loss', () => {
    // Simulate high packet loss (50%) on ap-south-1
    service.setPopHealth('ap-south-1', {
      packetLossPercent: 50,
      isHealthy: false,
    });

    const resolution = service.resolveDns({ countryCode: 'IN' });

    // Should fail over to another healthy POP (e.g., ap-northeast-1 or eu-central-1)
    expect(resolution.selectedPop.id).not.toBe('ap-south-1');
    expect(resolution.isFailover).toBe(true);
    expect(resolution.reason).toContain('Primary POP degraded; automatically rerouted');
  });

  it('probes POP responsiveness and lists all POPs', () => {
    const pops = service.getAllPops();
    expect(pops.length).toBeGreaterThanOrEqual(4);

    expect(() => service.probeAllPops()).not.toThrow();
  });
});
