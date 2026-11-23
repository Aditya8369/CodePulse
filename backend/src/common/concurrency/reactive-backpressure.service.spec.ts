import { ReactiveBackpressureService } from './reactive-backpressure.service';

describe('ReactiveBackpressureService', () => {
  let service: ReactiveBackpressureService;

  beforeEach(() => {
    service = new ReactiveBackpressureService({ maxMemoryBytes: 1000 });
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should initialize with HEALTHY signal', () => {
    expect(service.getSignal()).toBe('HEALTHY');
  });

  it('should transition to THROTTLE and SPILL_TO_DISK as memory fills', () => {
    // 700 bytes / 1000 = 70% -> THROTTLE
    service.push({ id: '1', data: 'data', sizeBytes: 750, priority: 'NORMAL', createdAt: Date.now() });
    expect(service.getSignal()).toBe('THROTTLE');

    // Push more bytes -> SPILL_TO_DISK
    const sig = service.push({ id: '2', data: 'overflow', sizeBytes: 200, priority: 'LOW', createdAt: Date.now() });
    expect(sig).toBe('SPILL_TO_DISK');
    expect(service.getMetrics().spilledChunksCount).toBe(1);
  });

  it('should poll chunks in FIFO order and recover to HEALTHY signal', () => {
    service.push({ id: 'c1', data: 'a', sizeBytes: 750, priority: 'CRITICAL', createdAt: Date.now() });
    expect(service.getSignal()).toBe('THROTTLE');

    const drained = service.poll();
    expect(drained?.id).toBe('c1');
    expect(service.getSignal()).toBe('HEALTHY');
  });
});
