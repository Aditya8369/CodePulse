import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';

export type GreenCodeBadgeTier =
  | 'PLATINUM_LEAF'
  | 'EMERALD_OPTIMIZER'
  | 'SOLAR_EFFICIENT'
  | 'STANDARD';

export interface CloudRegionCarbonFactor {
  region: string;
  provider: 'AWS' | 'GCP' | 'AZURE';
  displayName: string;
  carbonIntensityGCo2PerKwh: number;
  renewableSharePercent: number;
}

export interface EnergyCounterSample {
  source: 'INTEL_RAPL_SYSFS' | 'AMD_PERF_COUNTERS' | 'ESTIMATED_TDP';
  cpuEnergyMj: number;
  dramEnergyMj: number;
  totalEnergyMj: number;
  totalEnergyJoules: number;
  totalEnergyKwh: number;
  durationMs: number;
  averagePowerWatts: number;
}

export interface AlgorithmicEnergyHotspot {
  pattern: string;
  estimatedComplexity: 'O(N^2)' | 'O(N^3)';
  lineNumber: number;
  estimatedEnergyMultiplier: number;
  recommendation: string;
}

export interface CarbonRunAssessment {
  runId: string;
  repositoryId: string;
  region: string;
  carbonIntensityGCo2PerKwh: number;
  energy: EnergyCounterSample;
  estimatedCo2Grams: number;
  baselineCo2Grams: number;
  co2SavedGrams: number;
  co2SavingsPercent: number;
  greenCodeBadge: {
    awarded: boolean;
    tier: GreenCodeBadgeTier;
    label: string;
    energyPerRunMj: number;
  };
  algorithmicHotspots: AlgorithmicEnergyHotspot[];
}

export const CLOUD_CARBON_INTENSITY_FACTORS: Record<string, CloudRegionCarbonFactor> = {
  'aws:eu-north-1': {
    region: 'aws:eu-north-1',
    provider: 'AWS',
    displayName: 'Europe (Stockholm)',
    carbonIntensityGCo2PerKwh: 13,
    renewableSharePercent: 98,
  },
  'aws:us-west-2': {
    region: 'aws:us-west-2',
    provider: 'AWS',
    displayName: 'US West (Oregon)',
    carbonIntensityGCo2PerKwh: 98,
    renewableSharePercent: 84,
  },
  'aws:eu-west-1': {
    region: 'aws:eu-west-1',
    provider: 'AWS',
    displayName: 'Europe (Ireland)',
    carbonIntensityGCo2PerKwh: 276,
    renewableSharePercent: 45,
  },
  'aws:us-east-1': {
    region: 'aws:us-east-1',
    provider: 'AWS',
    displayName: 'US East (N. Virginia)',
    carbonIntensityGCo2PerKwh: 368,
    renewableSharePercent: 28,
  },
  'aws:ap-south-1': {
    region: 'aws:ap-south-1',
    provider: 'AWS',
    displayName: 'Asia Pacific (Mumbai)',
    carbonIntensityGCo2PerKwh: 632,
    renewableSharePercent: 22,
  },
};

const MJOULES_PER_KWH = 3_600_000_000; // 1 kWh = 3.6e6 J = 3.6e9 mJ
const PUE_MULTIPLIER = 1.15; // Hyperscale datacenter Power Usage Effectiveness

@Injectable()
export class GreenCarbonEstimatorService {
  private readonly historyByRepo = new Map<string, CarbonRunAssessment[]>();

  getSupportedRegions(): CloudRegionCarbonFactor[] {
    return Object.values(CLOUD_CARBON_INTENSITY_FACTORS);
  }

  resolveRegionFactor(region: string): CloudRegionCarbonFactor {
    const normalized = region.trim().toLowerCase();
    const withPrefix = normalized.includes(':') ? normalized : `aws:${normalized}`;
    const factor = CLOUD_CARBON_INTENSITY_FACTORS[withPrefix];
    if (!factor) {
      throw new BadRequestException(
        `Unsupported cloud region "${region}". Supported: ${Object.keys(CLOUD_CARBON_INTENSITY_FACTORS).join(', ')}`,
      );
    }
    return factor;
  }

  /**
   * Computes energy sample from Intel RAPL microjoule counter deltas (before/after execution),
   * handling 32/64-bit hardware counter wraparound via max_energy_range_uj.
   */
  parseIntelRaplDelta(params: {
    pkgBeforeUj: number;
    pkgAfterUj: number;
    dramBeforeUj?: number;
    dramAfterUj?: number;
    maxEnergyRangeUj?: number;
    durationMs: number;
  }): EnergyCounterSample {
    const maxRange = params.maxEnergyRangeUj ?? 262_143_328_850;
    const deltaUj = (before: number, after: number) =>
      after >= before ? after - before : maxRange - before + after;

    const cpuUj = deltaUj(params.pkgBeforeUj, params.pkgAfterUj);
    const dramUj =
      typeof params.dramBeforeUj === 'number' && typeof params.dramAfterUj === 'number'
        ? deltaUj(params.dramBeforeUj, params.dramAfterUj)
        : Math.round(cpuUj * 0.22);

    return this.buildEnergySample('INTEL_RAPL_SYSFS', cpuUj / 1000, dramUj / 1000, params.durationMs);
  }

  /**
   * Parses Linux AMD/Intel `perf stat` energy counter output (Joules) into millijoules and kWh.
   */
  parsePerfStatEnergyOutput(perfOutput: string, durationMs: number): EnergyCounterSample {
    const pkgMatch = perfOutput.match(/([\d.,]+)\s+Joules\s+power\/energy-pkg\//i);
    const ramMatch = perfOutput.match(/([\d.,]+)\s+Joules\s+power\/energy-ram\//i);

    if (!pkgMatch) {
      throw new BadRequestException('Unable to parse power/energy-pkg/ counter from perf output');
    }

    const cpuJoules = parseFloat(pkgMatch[1].replace(/,/g, ''));
    const dramJoules = ramMatch
      ? parseFloat(ramMatch[1].replace(/,/g, ''))
      : Number((cpuJoules * 0.2).toFixed(4));

    return this.buildEnergySample(
      'AMD_PERF_COUNTERS',
      cpuJoules * 1000,
      dramJoules * 1000,
      durationMs,
    );
  }

  /**
   * Reads live Linux RAPL sysfs counters when running on bare-metal/VM Linux runners,
   * falling back cleanly to deterministic CPU/RAM energy modeling in containerized environments.
   */
  readLinuxRaplSysfsUj(): { pkgUj: number; dramUj: number } | null {
    try {
      const pkgPath = '/sys/class/powercap/intel-rapl/intel-rapl:0/energy_uj';
      const dramPath = '/sys/class/powercap/intel-rapl/intel-rapl:0/intel-rapl:0:0/energy_uj';
      if (!fs.existsSync(pkgPath)) return null;
      const pkgUj = Number(fs.readFileSync(pkgPath, 'utf8').trim());
      const dramUj = fs.existsSync(dramPath)
        ? Number(fs.readFileSync(dramPath, 'utf8').trim())
        : Math.round(pkgUj * 0.22);
      if (!Number.isFinite(pkgUj)) return null;
      return { pkgUj, dramUj };
    } catch {
      return null;
    }
  }

  private buildEnergySample(
    source: EnergyCounterSample['source'],
    cpuEnergyMj: number,
    dramEnergyMj: number,
    durationMs: number,
  ): EnergyCounterSample {
    const safeDurationMs = Math.max(1, durationMs);
    const totalEnergyMj = Number((cpuEnergyMj + dramEnergyMj).toFixed(3));
    const totalEnergyJoules = Number((totalEnergyMj / 1000).toFixed(6));
    const totalEnergyKwh = Number(((totalEnergyMj * PUE_MULTIPLIER) / MJOULES_PER_KWH).toFixed(10));
    const averagePowerWatts = Number((totalEnergyJoules / (safeDurationMs / 1000)).toFixed(3));

    return {
      source,
      cpuEnergyMj: Number(cpuEnergyMj.toFixed(3)),
      dramEnergyMj: Number(dramEnergyMj.toFixed(3)),
      totalEnergyMj,
      totalEnergyJoules,
      totalEnergyKwh,
      durationMs: safeDurationMs,
      averagePowerWatts,
    };
  }

  /**
   * Scans code snippets for energy-wasteful nested quadratic/cubic loops (O(N^2) / O(N^3))
   * that cause superlinear CPU package power spikes on large inputs.
   */
  detectAlgorithmicEnergyHotspots(sourceCode?: string): AlgorithmicEnergyHotspot[] {
    if (!sourceCode || !sourceCode.trim()) return [];
    const lines = sourceCode.split('\n');
    const hotspots: AlgorithmicEnergyHotspot[] = [];
    let loopDepth = 0;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      const isLoopStart = /^(for|while)\s*\(/.test(trimmed) || /\.forEach\s*\(/.test(trimmed);
      if (isLoopStart) {
        loopDepth += 1;
        if (loopDepth === 2) {
          hotspots.push({
            pattern: trimmed.slice(0, 72),
            estimatedComplexity: 'O(N^2)',
            lineNumber: idx + 1,
            estimatedEnergyMultiplier: 14.5,
            recommendation:
              'Replace nested O(N^2) scan with a HashMap/Set lookup (O(N)) to cut CPU Joules by >85%.',
          });
        } else if (loopDepth >= 3) {
          hotspots.push({
            pattern: trimmed.slice(0, 72),
            estimatedComplexity: 'O(N^3)',
            lineNumber: idx + 1,
            estimatedEnergyMultiplier: 95.0,
            recommendation:
              'Refactor triple-nested O(N^3) loop using dynamic programming or indexed partitioning.',
          });
        }
      }
      const closeBraces = (trimmed.match(/\}/g) || []).length;
      if (closeBraces > 0 && loopDepth > 0) {
        loopDepth = Math.max(0, loopDepth - closeBraces);
      }
    });

    return hotspots;
  }

  /**
   * Awards a Green Code badge tier based on millijoules consumed per test run
   * and absence of quadratic/cubic algorithmic energy hotspots.
   */
  evaluateGreenCodeBadge(
    totalEnergyMj: number,
    hotspots: AlgorithmicEnergyHotspot[],
  ): CarbonRunAssessment['greenCodeBadge'] {
    if (hotspots.length > 0 || totalEnergyMj > 2_500) {
      return {
        awarded: false,
        tier: 'STANDARD',
        label: 'Standard Energy Profile',
        energyPerRunMj: totalEnergyMj,
      };
    }
    if (totalEnergyMj <= 250) {
      return {
        awarded: true,
        tier: 'PLATINUM_LEAF',
        label: 'Green Code: Platinum Leaf (<250 mJ)',
        energyPerRunMj: totalEnergyMj,
      };
    }
    if (totalEnergyMj <= 900) {
      return {
        awarded: true,
        tier: 'EMERALD_OPTIMIZER',
        label: 'Green Code: Emerald Optimizer (<900 mJ)',
        energyPerRunMj: totalEnergyMj,
      };
    }
    return {
      awarded: true,
      tier: 'SOLAR_EFFICIENT',
      label: 'Green Code: Solar Efficient (<2.5 J)',
      energyPerRunMj: totalEnergyMj,
    };
  }

  /**
   * Full carbon footprint & Green Code badge evaluation for a challenge execution or CI build.
   */
  estimateExecutionCarbon(params: {
    runId: string;
    repositoryId: string;
    region?: string;
    cpuEnergyMj: number;
    dramEnergyMj: number;
    durationMs: number;
    sourceCode?: string;
    baselineEnergyMj?: number;
  }): CarbonRunAssessment {
    const regionFactor = this.resolveRegionFactor(params.region ?? 'aws:us-east-1');
    const energy = this.buildEnergySample(
      'INTEL_RAPL_SYSFS',
      params.cpuEnergyMj,
      params.dramEnergyMj,
      params.durationMs,
    );

    const estimatedCo2Grams = Number(
      (energy.totalEnergyKwh * regionFactor.carbonIntensityGCo2PerKwh).toFixed(6),
    );

    // Compare against unoptimized us-east-1 baseline or explicit baselineEnergyMj
    const baselineMj = params.baselineEnergyMj ?? Math.max(energy.totalEnergyMj * 1.45, 1_800);
    const baselineKwh = (baselineMj * PUE_MULTIPLIER) / MJOULES_PER_KWH;
    const baselineCo2Grams = Number(
      (baselineKwh * CLOUD_CARBON_INTENSITY_FACTORS['aws:us-east-1'].carbonIntensityGCo2PerKwh).toFixed(6),
    );

    const co2SavedGrams = Number(Math.max(0, baselineCo2Grams - estimatedCo2Grams).toFixed(6));
    const co2SavingsPercent =
      baselineCo2Grams > 0
        ? Number(Math.max(0, ((baselineCo2Grams - estimatedCo2Grams) / baselineCo2Grams) * 100).toFixed(1))
        : 0;

    const algorithmicHotspots = this.detectAlgorithmicEnergyHotspots(params.sourceCode);
    const greenCodeBadge = this.evaluateGreenCodeBadge(energy.totalEnergyMj, algorithmicHotspots);

    const assessment: CarbonRunAssessment = {
      runId: params.runId,
      repositoryId: params.repositoryId,
      region: regionFactor.region,
      carbonIntensityGCo2PerKwh: regionFactor.carbonIntensityGCo2PerKwh,
      energy,
      estimatedCo2Grams,
      baselineCo2Grams,
      co2SavedGrams,
      co2SavingsPercent,
      greenCodeBadge,
      algorithmicHotspots,
    };

    const existing = this.historyByRepo.get(params.repositoryId) ?? [];
    existing.push(assessment);
    this.historyByRepo.set(params.repositoryId, existing);

    return assessment;
  }

  getRepositoryCarbonSummary(repositoryId: string) {
    const runs = this.historyByRepo.get(repositoryId) ?? [];
    const totalEnergyMj = runs.reduce((acc, r) => acc + r.energy.totalEnergyMj, 0);
    const totalCo2Grams = runs.reduce((acc, r) => acc + r.estimatedCo2Grams, 0);
    const totalCo2SavedGrams = runs.reduce((acc, r) => acc + r.co2SavedGrams, 0);
    const greenBadgesAwarded = runs.filter((r) => r.greenCodeBadge.awarded).length;

    return {
      repositoryId,
      totalRuns: runs.length,
      totalEnergyMj: Number(totalEnergyMj.toFixed(3)),
      totalCo2Grams: Number(totalCo2Grams.toFixed(6)),
      totalCo2SavedGrams: Number(totalCo2SavedGrams.toFixed(6)),
      greenBadgesAwarded,
      latestRun: runs[runs.length - 1] ?? null,
    };
  }
}
