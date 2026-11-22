import { BbrCongestionService } from './bbr-congestion.service';

describe('BbrCongestionService (#1056)', () => {
  let service: BbrCongestionService;

  beforeEach(() => {
    service = new BbrCongestionService();
  });

  it('registers a new stream session in STARTUP state', () => {
    const session = service.registerStream('stream-1056', 5000000);

    expect(session.streamId).toBe('stream-1056');
    expect(session.state).toBe('STARTUP');
    expect(session.cwndBytes).toBeGreaterThan(0);
    expect(session.pacingRateBytesPerSec).toBeGreaterThan(0);
  });

  it('advances through BBRv2 state machine upon ACK delivery without collapsing on packet loss', () => {
    service.registerStream('stream-1056', 10000000);

    // Initial ACK step (STARTUP -> DRAIN)
    const metrics1 = service.recordAck('stream-1056', 150000, 25, 0);
    expect(metrics1.state).toBe('DRAIN');

    // Second ACK step (DRAIN -> PROBE_BW)
    const metrics2 = service.recordAck('stream-1056', 150000, 24, 0);
    expect(metrics2.state).toBe('PROBE_BW');

    // Non-congestive random packet loss occurs (e.g. 5 packets lost on Wi-Fi)
    const metricsWithLoss = service.recordAck('stream-1056', 150000, 24, 5);
    expect(metricsWithLoss.state).toBe('PROBE_BW');
    // Pacing rate and CWND remain resilient without cutting in half
    expect(metricsWithLoss.pacingRateMbps).toBeGreaterThan(50);
  });

  it('demonstrates throughput resilience over Cubic under 3% random packet loss', () => {
    const comparison = service.simulateComparison(60, 0.03);

    expect(comparison.packetLossRate).toBe(0.03);
    // BBRv2 maintains > 90% throughput (> 45 Mbps on 50 Mbps link)
    expect(comparison.bbrv2.throughputMbps).toBeGreaterThanOrEqual(45);
    // Cubic collapses due to multiplicative decrease on loss
    expect(comparison.cubic.throughputMbps).toBeLessThan(30);
    // BBRv2 throughput gain factor is significant
    expect(comparison.throughputGainFactor).toBeGreaterThan(1.5);
  });

  it('unregisters session cleanly on disconnect', () => {
    service.registerStream('stream-to-close');
    expect(service.getSession('stream-to-close')).toBeDefined();

    service.unregisterStream('stream-to-close');
    expect(service.getSession('stream-to-close')).toBeUndefined();
  });
});
