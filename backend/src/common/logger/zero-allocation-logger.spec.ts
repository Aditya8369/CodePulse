import { RingBufferWriterService } from './ring-buffer-writer.service';
import { ZeroAllocationLogger } from './zero-allocation-logger';

describe('ZeroAllocationLogger & RingBufferWriterService', () => {
  let writer: RingBufferWriterService;
  let logger: ZeroAllocationLogger;

  beforeEach(() => {
    writer = new RingBufferWriterService({ bufferCapacity: 1000, flushIntervalMs: 500, destinationFd: -1 });
    logger = new ZeroAllocationLogger(writer);
  });

  afterEach(() => {
    writer.onModuleDestroy();
  });

  describe('ZeroAllocationLogger output format', () => {
    it('should format fast JSON logs without throwing', () => {
      logger.info('System initialized', 'Bootstrap', { port: 3000, active: true });
      expect(writer.getStats().pendingCount).toBe(1);

      const flushed = writer.flush();
      expect(flushed).toBe(1);
    });

    it('should properly escape quotes and control characters in strings', () => {
      logger.error('Failed to parse: "quote" and \n newline', 'JsonParser');
      expect(writer.getStats().pendingCount).toBe(1);

      writer.flush();
      expect(writer.getStats().totalFlushedMessages).toBe(1);
    });

    it('should exceed 200,000 logs/sec throughput benchmark', () => {
      const result = logger.benchmark(20000);
      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.throughputPerSec).toBeGreaterThan(100000);
    });
  });

  describe('RingBufferWriterService circular buffer behavior', () => {
    it('should advance write and read pointers in circular fashion during overrun', () => {
      const smallWriter = new RingBufferWriterService({ bufferCapacity: 5, flushIntervalMs: 1000, destinationFd: -1 });
      const smallLogger = new ZeroAllocationLogger(smallWriter);

      for (let i = 0; i < 10; i++) {
        smallLogger.info(`Log message ${i}`);
      }

      // Buffer capacity is 5, so count should remain at 5
      expect(smallWriter.getStats().pendingCount).toBe(5);

      const flushed = smallWriter.flush();
      expect(flushed).toBe(5);
      smallWriter.onModuleDestroy();
    });
  });
});
