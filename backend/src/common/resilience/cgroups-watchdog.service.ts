import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';

export interface CgroupMetrics {
  version: 'v1' | 'v2' | 'fallback';
  currentMemoryBytes: number;
  limitMemoryBytes: number;
  memoryHeadroomPercent: number;
  memoryPressureRatio: number;
  isLoadSheddingActive: boolean;
}

@Injectable()
export class CgroupsWatchdogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CgroupsWatchdogService.name);

  private monitorTimer?: NodeJS.Timeout;
  private isLoadSheddingActive = false;
  private currentPressureRatio = 0.0;

  // Paths for cgroup detection
  private cgroupV2CurrentPath = '/sys/fs/cgroup/memory.current';
  private cgroupV2MaxPath = '/sys/fs/cgroup/memory.max';
  private cgroupV1UsagePath = '/sys/fs/cgroup/memory/memory.usage_in_bytes';
  private cgroupV1LimitPath = '/sys/fs/cgroup/memory/memory.limit_in_bytes';

  onModuleInit() {
    this.startWatchdog(5000); // 5s interval
  }

  onModuleDestroy() {
    this.stopWatchdog();
  }

  public setMockPaths(paths: {
    v2Current?: string;
    v2Max?: string;
    v1Usage?: string;
    v1Limit?: string;
  }): void {
    if (paths.v2Current) this.cgroupV2CurrentPath = paths.v2Current;
    if (paths.v2Max) this.cgroupV2MaxPath = paths.v2Max;
    if (paths.v1Usage) this.cgroupV1UsagePath = paths.v1Usage;
    if (paths.v1Limit) this.cgroupV1LimitPath = paths.v1Limit;
  }

  public startWatchdog(intervalMs = 5000): void {
    if (this.monitorTimer) return;
    this.monitorTimer = setInterval(() => this.evaluatePressure(), intervalMs);
    if (this.monitorTimer.unref) {
      this.monitorTimer.unref();
    }
  }

  public stopWatchdog(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = undefined;
    }
  }

  /**
   * Evaluates memory limits and pressure against container ceiling.
   */
  public evaluatePressure(): CgroupMetrics {
    let version: 'v1' | 'v2' | 'fallback' = 'fallback';
    let currentBytes = 0;
    let limitBytes = 512 * 1024 * 1024; // default 512MB

    // Check cgroup v2
    if (fs.existsSync(this.cgroupV2CurrentPath) && fs.existsSync(this.cgroupV2MaxPath)) {
      try {
        currentBytes = parseInt(fs.readFileSync(this.cgroupV2CurrentPath, 'utf8').trim(), 10);
        const maxStr = fs.readFileSync(this.cgroupV2MaxPath, 'utf8').trim();
        if (maxStr !== 'max') {
          limitBytes = parseInt(maxStr, 10);
        }
        version = 'v2';
      } catch {
        version = 'fallback';
      }
    } else if (fs.existsSync(this.cgroupV1UsagePath) && fs.existsSync(this.cgroupV1LimitPath)) {
      // Check cgroup v1
      try {
        currentBytes = parseInt(fs.readFileSync(this.cgroupV1UsagePath, 'utf8').trim(), 10);
        limitBytes = parseInt(fs.readFileSync(this.cgroupV1LimitPath, 'utf8').trim(), 10);
        version = 'v1';
      } catch {
        version = 'fallback';
      }
    } else {
      // Fallback to process.memoryUsage()
      const mem = process.memoryUsage();
      currentBytes = mem.rss;
      version = 'fallback';
    }

    const pressureRatio = limitBytes > 0 ? currentBytes / limitBytes : 0;
    const headroomPercent = Math.max(0, (1 - pressureRatio) * 100);

    // If headroom drops below 10% (pressure > 0.90), activate load shedding
    const shouldShed = headroomPercent < 10.0;
    if (shouldShed && !this.isLoadSheddingActive) {
      this.logger.error(
        `🚨 Container memory headroom dropped to ${headroomPercent.toFixed(1)}% (< 10%). Activating emergency load shedding!`,
      );
    } else if (!shouldShed && this.isLoadSheddingActive) {
      this.logger.log(`Container memory headroom recovered to ${headroomPercent.toFixed(1)}%. Deactivating load shedding.`);
    }

    this.isLoadSheddingActive = shouldShed;
    this.currentPressureRatio = Number(pressureRatio.toFixed(3));

    return {
      version,
      currentMemoryBytes: currentBytes,
      limitMemoryBytes: limitBytes,
      memoryHeadroomPercent: Number(headroomPercent.toFixed(1)),
      memoryPressureRatio: this.currentPressureRatio,
      isLoadSheddingActive: this.isLoadSheddingActive,
    };
  }

  public shouldShedLoad(): boolean {
    return this.isLoadSheddingActive;
  }

  public getPrometheusMetrics(): string {
    return `# HELP container_memory_pressure_ratio Ratio of current memory usage to container limit\n# TYPE container_memory_pressure_ratio gauge\ncontainer_memory_pressure_ratio ${this.currentPressureRatio}\n`;
  }
}
