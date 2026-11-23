import { ZeroCopyIpcService } from './zero-copy-ipc.service';
import { SandboxStreamFrame } from './zero-copy-ipc.types';

describe('ZeroCopyIpcService', () => {
  let ipcService: ZeroCopyIpcService;

  beforeEach(() => {
    ipcService = new ZeroCopyIpcService({ initialPoolSize: 4 });
  });

  afterEach(() => {
    ipcService.onModuleDestroy();
  });

  it('should acquire and initialize a SharedArrayBuffer channel for execution', () => {
    const desc = ipcService.acquireExecutionChannel({
      executionId: 'exec-101',
      slotCapacity: 512,
      slotSizeBytes: 256,
    });

    expect(desc.channelId).toBeDefined();
    expect(desc.controlBuffer).toBeInstanceOf(SharedArrayBuffer);
    expect(desc.payloadBuffer).toBeInstanceOf(SharedArrayBuffer);
    expect(desc.metaBuffer).toBeInstanceOf(SharedArrayBuffer);
    expect(desc.slotCapacity).toBeGreaterThanOrEqual(512);
  });

  it('should write and read STDOUT stream chunks without JSON serialization', () => {
    ipcService.acquireExecutionChannel({ executionId: 'exec-stdout-test' });

    const testOutput = 'Compilation succeeded in 142ms\nOutput: [42, 99, 100]';
    const rawData = new TextEncoder().encode(testOutput);

    const written = ipcService.writeStreamChunk('exec-stdout-test', 'STDOUT', rawData);
    expect(written).toBe(true);

    const frame = ipcService.readNextFrame('exec-stdout-test');
    expect(frame).not.toBeNull();
    expect(frame?.streamType).toBe('STDOUT');
    expect(frame?.byteLength).toBe(rawData.byteLength);

    const decoded = new TextDecoder().decode(frame?.payload);
    expect(decoded).toBe(testOutput);
  });

  it('should write and read STDERR stream chunks properly', () => {
    ipcService.acquireExecutionChannel({ executionId: 'exec-stderr-test' });

    const errMessage = 'Segmentation fault (core dumped) at 0x7ffd9a8';
    const rawData = new TextEncoder().encode(errMessage);

    const written = ipcService.writeStreamChunk('exec-stderr-test', 'STDERR', rawData);
    expect(written).toBe(true);

    const frame = ipcService.readNextFrame('exec-stderr-test');
    expect(frame?.streamType).toBe('STDERR');
    expect(new TextDecoder().decode(frame?.payload)).toBe(errMessage);
  });

  it('should dispatch stream frames to registered real-time subscribers', () => {
    ipcService.acquireExecutionChannel({ executionId: 'exec-sub-test' });

    const received: SandboxStreamFrame[] = [];
    const unsubscribe = ipcService.subscribeToStream('exec-sub-test', (frame) => {
      received.push(frame);
    });

    const msg = 'Real-time WebSocket streaming frame';
    ipcService.writeStreamChunk('exec-sub-test', 'EXEC_EVENT', new TextEncoder().encode(msg));

    expect(received.length).toBe(1);
    expect(received[0].streamType).toBe('EXEC_EVENT');
    expect(new TextDecoder().decode(received[0].payload)).toBe(msg);

    unsubscribe();
  });

  it('should drain multiple queued frames in FIFO order', () => {
    ipcService.acquireExecutionChannel({ executionId: 'exec-drain-test' });

    for (let i = 0; i < 10; i++) {
      const line = `Log line ${i}\n`;
      ipcService.writeStreamChunk('exec-drain-test', 'STDOUT', new TextEncoder().encode(line));
    }

    const drained = ipcService.drainFrames('exec-drain-test');
    expect(drained.length).toBe(10);
    expect(new TextDecoder().decode(drained[0].payload)).toBe('Log line 0\n');
    expect(new TextDecoder().decode(drained[9].payload)).toBe('Log line 9\n');

    // Subsequent read should return null
    expect(ipcService.readNextFrame('exec-drain-test')).toBeNull();
  });

  it('should recycle channel when execution completes', () => {
    ipcService.acquireExecutionChannel({ executionId: 'exec-recycle-1' });
    ipcService.releaseExecutionChannel('exec-recycle-1');

    const metrics = ipcService.getMetrics();
    expect(metrics.totalChannelsRecycled).toBe(1);

    // Can allocate new execution using recycled channel
    const desc = ipcService.acquireExecutionChannel({ executionId: 'exec-recycle-2' });
    expect(desc.channelId).toBeDefined();
  });

  it('should accurately calculate memory savings and IPC throughput metrics', () => {
    ipcService.acquireExecutionChannel({ executionId: 'exec-metrics' });

    const chunk = new TextEncoder().encode('x'.repeat(500));
    for (let i = 0; i < 50; i++) {
      ipcService.writeStreamChunk('exec-metrics', 'STDOUT', chunk);
      ipcService.readNextFrame('exec-metrics');
    }

    const metrics = ipcService.getMetrics();
    expect(metrics.totalFramesProduced).toBe(50);
    expect(metrics.totalFramesConsumed).toBe(50);
    expect(metrics.totalBytesTransferred).toBe(25000);
    expect(metrics.estimatedMemorySavedBytes).toBeGreaterThanOrEqual(50000); // 2.5x
  });
});
