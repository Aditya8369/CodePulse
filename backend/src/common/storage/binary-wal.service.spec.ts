import * as fs from 'fs';
import * as path from 'path';
import { BinaryWalService, computeCrc32 } from './binary-wal.service';
import { WalCompactorService } from './wal-compactor.service';

describe('BinaryWalService & WalCompactorService', () => {
  const testWalDir = path.join(process.cwd(), 'data', 'test_wal');
  let wal: BinaryWalService;
  let compactor: WalCompactorService;

  beforeEach(() => {
    if (fs.existsSync(testWalDir)) {
      fs.rmSync(testWalDir, { recursive: true, force: true });
    }
    wal = new BinaryWalService({
      walDirectory: testWalDir,
      syncPolicy: 'ALWAYS_FSYNC',
      segmentMaxSizeBytes: 1024 * 1024,
    });
    wal.onModuleInit();
    compactor = new WalCompactorService(wal, { walDirectory: testWalDir });
  });

  afterEach(() => {
    wal.onModuleDestroy();
    if (fs.existsSync(testWalDir)) {
      fs.rmSync(testWalDir, { recursive: true, force: true });
    }
  });

  it('should compute valid IEEE 802.3 CRC32 checksums', () => {
    const data = Buffer.from('hello world', 'utf8');
    const crc = computeCrc32(data);
    expect(crc).toBe(0x0d4a1185); // Known IEEE 802.3 CRC32 for 'hello world'
  });

  it('should append records with monotonic LSN and CRC32 header', () => {
    const r1 = wal.append('DATA_MUTATION', 'battle:101', { playerA: 10, playerB: 20 });
    expect(r1.lsn).toBe(1n);
    expect(r1.crc32).toBeDefined();

    const r2 = wal.append('DATA_MUTATION', 'battle:102', { playerA: 15, playerB: 25 });
    expect(r2.lsn).toBe(2n);
    expect(wal.getCurrentLsn()).toBe(2n);
  });

  it('should recover state accurately during crash recovery replay', () => {
    wal.append('TX_BEGIN', 'tx-1', {});
    wal.append('DATA_MUTATION', 'state:user:1', { gold: 500 });
    wal.append('DATA_MUTATION', 'state:user:2', { gold: 300 });
    wal.append('TX_COMMIT', 'tx-1', {});
    wal.flushBuffer(true);

    const report = wal.recover();
    expect(report.recoveredRecordsCount).toBe(4);
    expect(report.latestLsn).toBe(4n);
    expect(report.corruptedRecordsSkipped).toBe(0);
  });

  it('should detect torn/corrupted writes via CRC32 mismatch and safely discard them', () => {
    wal.append('DATA_MUTATION', 'safe:item:1', { value: 100 });
    wal.flushBuffer(true);

    // Intentionally corrupt bytes at the end of the file
    const files = fs.readdirSync(testWalDir).filter((f) => f.endsWith('.wal'));
    const filePath = path.join(testWalDir, files[0]);
    const corruptedPayload = Buffer.from('CORRUPTED_BYTES_WITHOUT_VALID_CRC', 'utf8');
    fs.appendFileSync(filePath, corruptedPayload);

    const report = wal.recover();
    expect(report.recoveredRecordsCount).toBe(1); // Safe item recovered
    expect(report.corruptedRecordsSkipped).toBeGreaterThanOrEqual(1); // Corrupted trailer discarded
  });

  it('should create snapshot and prune old segments using WalCompactorService', () => {
    const state = new Map<string, number>();
    state.set('clan:1:score', 990);
    state.set('clan:2:score', 850);

    wal.append('DATA_MUTATION', 'clan:1:score', 990);
    wal.append('DATA_MUTATION', 'clan:2:score', 850);

    const snapshot = compactor.createSnapshot(state);
    expect(snapshot.snapshotId).toBeDefined();
    expect(snapshot.recordCount).toBe(2);
    expect(fs.existsSync(snapshot.filePath)).toBe(true);
  });

  it('should achieve high append throughput', () => {
    const start = Date.now();
    for (let i = 0; i < 2000; i++) {
      wal.append('DATA_MUTATION', `key:${i}`, { count: i });
    }
    const duration = Date.now() - start;

    expect(wal.getCurrentLsn()).toBe(2000n);
    expect(duration).toBeLessThan(1000); // 2000 records in <1 sec
  });
});
