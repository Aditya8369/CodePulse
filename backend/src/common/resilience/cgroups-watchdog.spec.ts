import { CgroupsWatchdogService } from './cgroups-watchdog.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('CgroupsWatchdogService', () => {
  let watchdog: CgroupsWatchdogService;
  let tempDir: string;

  beforeEach(() => {
    watchdog = new CgroupsWatchdogService();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cgroup-test-'));
  });

  afterEach(() => {
    watchdog.onModuleDestroy();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('should fall back safely when cgroup paths do not exist', () => {
    const metrics = watchdog.evaluatePressure();
    expect(metrics.version).toBe('fallback');
    expect(metrics.currentMemoryBytes).toBeGreaterThan(0);
    expect(metrics.limitMemoryBytes).toBeGreaterThan(0);
    expect(metrics.memoryHeadroomPercent).toBeGreaterThanOrEqual(0);
  });

  it('should parse cgroup v2 files and activate load shedding when headroom < 10%', () => {
    const v2Current = path.join(tempDir, 'memory.current');
    const v2Max = path.join(tempDir, 'memory.max');

    // 460MB used out of 500MB limit (headroom: 40MB / 500MB = 8% < 10%)
    fs.writeFileSync(v2Current, `${460 * 1024 * 1024}`);
    fs.writeFileSync(v2Max, `${500 * 1024 * 1024}`);

    watchdog.setMockPaths({ v2Current, v2Max });
    const metrics = watchdog.evaluatePressure();

    expect(metrics.version).toBe('v2');
    expect(metrics.memoryHeadroomPercent).toBe(8);
    expect(metrics.isLoadSheddingActive).toBe(true);
    expect(watchdog.shouldShedLoad()).toBe(true);

    const prom = watchdog.getPrometheusMetrics();
    expect(prom).toContain('container_memory_pressure_ratio 0.92');
  });

  it('should deactivate load shedding when headroom recovers above 10%', () => {
    const v2Current = path.join(tempDir, 'memory.current');
    const v2Max = path.join(tempDir, 'memory.max');

    // 200MB used out of 500MB limit (headroom: 300MB = 60% > 10%)
    fs.writeFileSync(v2Current, `${200 * 1024 * 1024}`);
    fs.writeFileSync(v2Max, `${500 * 1024 * 1024}`);

    watchdog.setMockPaths({ v2Current, v2Max });
    const metrics = watchdog.evaluatePressure();

    expect(metrics.memoryHeadroomPercent).toBe(60);
    expect(metrics.isLoadSheddingActive).toBe(false);
    expect(watchdog.shouldShedLoad()).toBe(false);
  });
});
