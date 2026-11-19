import { EbpfMetricsService } from './ebpf-metrics.service';

describe('EbpfMetricsService Suite', () => {
  let service: EbpfMetricsService;

  beforeEach(() => {
    service = new EbpfMetricsService();
    service.startRingBufferConsumer();
  });

  afterEach(() => {
    service.stopRingBufferConsumer();
  });

  describe('Microservice Identification', () => {
    it('should map ports to services correctly', () => {
      expect(service.identifyService(45000, 5432)).toBe('POSTGRES');
      expect(service.identifyService(5432, 45000)).toBe('POSTGRES');
      expect(service.identifyService(45000, 6379)).toBe('REDIS');
      expect(service.identifyService(45000, 3001)).toBe('NESTJS');
      expect(service.identifyService(8080, 80)).toBe('UNKNOWN');
    });
  });

  describe('eBPF Event Ingestion and Latency Measurement', () => {
    it('should measure TCP handshake latency with sub-microsecond precision and negligible CPU overhead', () => {
      service.ingestEbpfEvent({
        sourceAddress: '10.0.0.1',
        destinationAddress: '10.0.0.2',
        sourcePort: 45000,
        destinationPort: 5432,
        service: 'POSTGRES',
        latencyUs: 450, // 450 microseconds
        retransmits: 0,
        drops: 0,
        queueBacklog: 2,
        pid: 1234,
        comm: 'node',
        timestamp: new Date().toISOString(),
      });

      const summary = service.getMetricsSummary();
      expect(summary.totalEventsProcessed).toBe(1);
      expect(summary.metricsSummary.postgres.avgLatencyUs).toBe(450);
      expect(summary.cpuOverheadPercent).toBeLessThan(0.2); // Negligible CPU overhead
    });

    it('should detect packet drops and TCP retransmissions before application timeouts', () => {
      service.ingestEbpfEvent({
        sourceAddress: '10.0.0.1',
        destinationAddress: '10.0.0.3',
        sourcePort: 45001,
        destinationPort: 6379,
        service: 'REDIS',
        latencyUs: 0,
        retransmits: 3,
        drops: 1,
        pid: 1235,
        comm: 'redis-cli',
        timestamp: new Date().toISOString(),
      });

      const summary = service.getMetricsSummary();
      expect(summary.detectedRetransmissionsCount).toBe(3);
      expect(summary.detectedPacketDropsCount).toBe(1);
      expect(summary.metricsSummary.redis.retransmitCount).toBe(3);
      expect(summary.metricsSummary.redis.queueDropsCount).toBe(1);
    });

    it('should identify microsecond latency stalls (> 5000us)', () => {
      service.ingestEbpfEvent({
        sourceAddress: '10.0.0.1',
        destinationAddress: '10.0.0.4',
        sourcePort: 45002,
        destinationPort: 3001,
        service: 'NESTJS',
        latencyUs: 8500, // 8.5ms stall
        retransmits: 0,
        drops: 0,
        pid: 1236,
        comm: 'node-api',
        timestamp: new Date().toISOString(),
      });

      const summary = service.getMetricsSummary();
      expect(summary.detectedNetworkStallsCount).toBe(1);
      expect(summary.recentStalls.length).toBe(1);
      expect(summary.recentStalls[0].latencyUs).toBe(8500);
      expect(summary.recentStalls[0].service).toBe('NESTJS');
    });
  });

  describe('Latency Heatmaps Generation', () => {
    it('should generate heatmap distributions across microservice network interfaces', () => {
      service.ingestEbpfEvent({
        sourceAddress: '10.0.0.1',
        destinationAddress: '10.0.0.2',
        sourcePort: 45000,
        destinationPort: 5432,
        service: 'POSTGRES',
        latencyUs: 45,
        retransmits: 0,
        drops: 0,
        pid: 100,
        comm: 'postgres',
        timestamp: new Date().toISOString(),
      });

      service.ingestEbpfEvent({
        sourceAddress: '10.0.0.1',
        destinationAddress: '10.0.0.2',
        sourcePort: 45000,
        destinationPort: 5432,
        service: 'POSTGRES',
        latencyUs: 150,
        retransmits: 0,
        drops: 0,
        pid: 100,
        comm: 'postgres',
        timestamp: new Date().toISOString(),
      });

      const heatmaps = service.generateHeatmaps();
      expect(heatmaps.length).toBe(3);

      const pgHeatmap = heatmaps.find((h) => h.service === 'POSTGRES');
      expect(pgHeatmap).toBeDefined();
      expect(pgHeatmap?.totalPackets).toBe(2);
      expect(pgHeatmap?.buckets.length).toBe(6);
    });
  });

  describe('Prometheus Metrics Export', () => {
    it('should export Prometheus format string with eBPF metrics', async () => {
      service.ingestEbpfEvent({
        sourceAddress: '10.0.0.1',
        destinationAddress: '10.0.0.2',
        sourcePort: 45000,
        destinationPort: 5432,
        service: 'POSTGRES',
        latencyUs: 120,
        retransmits: 1,
        drops: 0,
        pid: 100,
        comm: 'node',
        timestamp: new Date().toISOString(),
      });

      const metrics = await service.getPrometheusMetrics();
      expect(metrics).toContain('codepulse_ebpf_tcp_handshake_duration_us');
      expect(metrics).toContain('codepulse_ebpf_tcp_retransmit_total');
      expect(metrics).toContain('codepulse_ebpf_cpu_overhead_percent');
    });
  });
});
