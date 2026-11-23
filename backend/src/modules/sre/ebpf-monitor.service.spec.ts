import { Test, TestingModule } from '@nestjs/testing';
import {
  EbpfMonitorService,
  EbpfTcpEvent,
  IEbpfRingBufferReader,
} from './ebpf-monitor.service';

describe('EbpfMonitorService SRE Kernel Network Observability (#1078)', () => {
  let service: EbpfMonitorService;
  let mockReader: IEbpfRingBufferReader;
  let eventCallback: ((event: EbpfTcpEvent) => void) | null = null;

  beforeEach(async () => {
    mockReader = {
      startListening: jest.fn((cb) => {
        eventCallback = cb;
      }),
      stopListening: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EbpfMonitorService],
    }).compile();

    service = module.get<EbpfMonitorService>(EbpfMonitorService);
    service.setRingBufferReader(mockReader);
    service.startTracing();
  });

  afterEach(() => {
    service.stopTracing();
  });

  describe('Kernel Probe Attachment & Ring Buffer Ingestion', () => {
    it('starts listening to eBPF ring buffer stream and processes TCP events', () => {
      expect(mockReader.startListening).toHaveBeenCalled();

      const sampleEvent: EbpfTcpEvent = {
        sourceAddress: '10.0.0.1',
        destinationAddress: '10.0.0.2',
        sourcePort: 54321,
        destinationPort: 5432,
        service: 'POSTGRES',
        latencyUs: 450, // 450 microseconds
        retransmits: 0,
        drops: 0,
        pid: 1234,
        comm: 'postgres-conn',
        timestamp: new Date().toISOString(),
      };

      eventCallback!(sampleEvent);

      const summary = service.getObservabilitySummary();
      expect(summary.totalEventsProcessed).toBe(1);
      expect(summary.bpfLoaded).toBe(true);
      expect(summary.metricsSummary.postgres.avgLatencyUs).toBe(450);
    });
  });

  describe('Packet Drops & Kernel Socket Queue Contention Detection', () => {
    it('detects packet retransmits and socket buffer drops without user-space overhead', () => {
      const dropEvent: EbpfTcpEvent = {
        sourceAddress: '10.0.1.5',
        destinationAddress: '10.0.1.6',
        sourcePort: 63790,
        destinationPort: 6379,
        service: 'REDIS',
        latencyUs: 8500, // 8.5ms stall (> 5000us threshold)
        retransmits: 3,
        drops: 12,
        pid: 5678,
        comm: 'redis-server',
        timestamp: new Date().toISOString(),
      };

      eventCallback!(dropEvent);

      const summary = service.getObservabilitySummary();
      expect(summary.detectedNetworkStallsCount).toBe(1);
      expect(summary.metricsSummary.redis.retransmitCount).toBe(3);
      expect(summary.metricsSummary.redis.queueDropsCount).toBe(12);
      expect(summary.recentStalls.length).toBe(1);
      expect(summary.recentStalls[0].service).toBe('REDIS');
      expect(summary.recentStalls[0].reason).toContain('Kernel network stall detected');
    });
  });

  describe('Prometheus Metrics Export', () => {
    it('registers Prometheus metrics for retransmissions and socket drops', async () => {
      const event: EbpfTcpEvent = {
        sourceAddress: '127.0.0.1',
        destinationAddress: '127.0.0.1',
        sourcePort: 3000,
        destinationPort: 3001,
        service: 'NESTJS',
        latencyUs: 120,
        retransmits: 1,
        drops: 2,
        pid: 9999,
        comm: 'node',
        timestamp: new Date().toISOString(),
      };

      eventCallback!(event);

      const promMetrics = await service.getPrometheusMetrics();
      expect(promMetrics).toContain('ebpf_tcp_retransmissions_total');
      expect(promMetrics).toContain('ebpf_socket_queue_drops_total');
      expect(promMetrics).toContain('ebpf_tcp_handshake_latency_microseconds');
    });
  });
});
