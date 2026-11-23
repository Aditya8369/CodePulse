import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Gauge, Histogram, Counter, Registry } from 'prom-client';
import {
  EbpfMonitorService as ObservabilityEbpfMonitorService,
  EbpfTcpEvent,
  EbpfObservabilitySummary,
  IEbpfRingBufferReader,
  MonitoredService,
} from '../observability/ebpf-monitor.service';

export * from '../observability/ebpf-monitor.service';

/**
 * eBPF Kernel-Level Network Observability & Socket Latency Tracker (#1078)
 *
 * Attaches eBPF bytecode probes to Linux kernel TCP event tracepoints (tcp_retransmit_skb,
 * sock_queue_rcv_skb, tcp_set_state) to measure exact kernel socket queue latencies,
 * detect packet drops, and expose metrics directly to Prometheus without userspace overhead.
 */
@Injectable()
export class EbpfMonitorService extends ObservabilityEbpfMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly sreLogger = new Logger(EbpfMonitorService.name);

  constructor() {
    super();
    this.sreLogger.log('eBPF SRE Kernel-Level Network Observability Service initialized');
  }
}
