import { GrpcStreamService, RunnerStreamMessageDto } from './grpc.service';

describe('GrpcStreamService & Gateway', () => {
  let service: GrpcStreamService;

  beforeEach(() => {
    service = new GrpcStreamService();
  });

  it('records runner heartbeat correctly', () => {
    const res = service.recordHeartbeat('runner-1', 'READY', 2);
    expect(res.acknowledged).toBe(true);
    expect(res.serverTimeMs).toBeGreaterThan(0);

    const metrics = service.getMetrics();
    expect(metrics.activeRunners).toBe(1);
  });

  it('processes execution log chunks and routes to subscriber streams', (done) => {
    const battleId = 'battle-streaming-101';
    const logStream = service.getOrCreateLogStream(battleId);

    logStream.subscribe((chunk) => {
      expect(chunk.battleId).toBe(battleId);
      expect(chunk.streamType).toBe('STDOUT');
      expect(chunk.chunkData.toString()).toBe('Compiling solution.cpp');
      expect(chunk.lineNumber).toBe(1);
      done();
    });

    const msg: RunnerStreamMessageDto = {
      battleId,
      runnerId: 'runner-1',
      sequence: 1,
      timestampMs: Date.now(),
      logChunk: {
        battleId,
        streamType: 'STDOUT',
        chunkData: Buffer.from('Compiling solution.cpp'),
        lineNumber: 1,
      },
    };

    service.processRunnerMessage(msg);
  });

  it('delivers server control signals to runner subscribers', (done) => {
    const battleId = 'battle-control-202';
    const controlStream = service.getOrCreateControlStream(battleId);

    controlStream.subscribe((signal) => {
      expect(signal.battleId).toBe(battleId);
      expect(signal.action).toBe('PAUSE');
      done();
    });

    service.sendControlSignal({
      battleId,
      action: 'PAUSE',
      timestampMs: Date.now(),
    });
  });

  it('handles high throughput bursts without buffer corruption', () => {
    const battleId = 'battle-burst-303';
    const totalMsgs = 10000;

    for (let i = 0; i < totalMsgs; i++) {
      service.processRunnerMessage({
        battleId,
        runnerId: 'runner-node-1',
        sequence: i,
        timestampMs: Date.now(),
        logChunk: {
          battleId,
          streamType: 'STDOUT',
          chunkData: `Execution iteration ${i} log statement`,
          lineNumber: i + 1,
        },
      });
    }

    const metrics = service.getMetrics();
    expect(metrics.totalMessagesReceived).toBe(totalMsgs);
    expect(metrics.totalBytesProcessed).toBeGreaterThan(0);
  });

  it('runs benchmark comparing Protobuf binary vs JSON serialization', () => {
    const benchmark = service.benchmarkProtobufVsJson(500);
    expect(benchmark.messageCount).toBe(500);
    expect(benchmark.latencyReductionFactor).toBeGreaterThanOrEqual(1);
    expect(benchmark.protobufPayloadBytes).toBeLessThan(benchmark.jsonPayloadBytes);
    expect(benchmark.compressionRatio).toBeGreaterThan(1);
  });
});
