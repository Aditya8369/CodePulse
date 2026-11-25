/**
 * Architecture Service: Developer Onboarding Interactive CLI Setup Wizard
 * Subsystem: Advanced Observability & Developer Experience [OBS-DX-21]
 */

export interface EnvValidationResult {
  nodeValid: boolean;
  nodeVersion: string;
  dockerActive: boolean;
  databaseConnected: boolean;
  latencyMs: number;
}

export interface SeedResult {
  success: boolean;
  tablesSeeded: number;
  recordsInserted: number;
  durationMs: number;
}

export interface OnboardingReport {
  timestamp: number;
  environment: EnvValidationResult;
  seed: SeedResult;
  isReady: boolean;
  summaryMessage: string;
}

export class DeveloperOnboardingWizardService {
  private minNodeMajorVersion: number;

  constructor(minNodeMajorVersion: number = 20) {
    this.minNodeMajorVersion = minNodeMajorVersion;
  }

  public validateNodeVersion(versionString: string): { valid: boolean; majorVersion: number; message: string } {
    const clean = versionString.startsWith('v') ? versionString.slice(1) : versionString;
    const major = parseInt(clean.split('.')[0], 10);
    const valid = !isNaN(major) && major >= this.minNodeMajorVersion;

    return {
      valid,
      majorVersion: major,
      message: valid 
        ? 'Node.js version ' + versionString + ' meets requirement (>=' + this.minNodeMajorVersion + ')'
        : 'Node.js version ' + versionString + ' is below minimum required version ' + this.minNodeMajorVersion
    };
  }

  public async checkEnvironment(
    nodeVersion: string,
    dockerPing: () => Promise<boolean>,
    dbPing: () => Promise<{ connected: boolean; latencyMs: number }>
  ): Promise<EnvValidationResult> {
    const nodeCheck = this.validateNodeVersion(nodeVersion);
    let dockerActive = false;
    try {
      dockerActive = await dockerPing();
    } catch {
      dockerActive = false;
    }

    let dbRes = { connected: false, latencyMs: 0 };
    try {
      dbRes = await dbPing();
    } catch {
      dbRes = { connected: false, latencyMs: -1 };
    }

    return {
      nodeValid: nodeCheck.valid,
      nodeVersion,
      dockerActive,
      databaseConnected: dbRes.connected,
      latencyMs: dbRes.latencyMs
    };
  }

  public async seedLocalFixtures(
    seederFn: () => Promise<{ tables: number; records: number }>
  ): Promise<SeedResult> {
    const start = Date.now();
    try {
      const { tables, records } = await seederFn();
      return {
        success: true,
        tablesSeeded: tables,
        recordsInserted: records,
        durationMs: Date.now() - start
      };
    } catch {
      return {
        success: false,
        tablesSeeded: 0,
        recordsInserted: 0,
        durationMs: Date.now() - start
      };
    }
  }

  public async runOnboarding(
    nodeVersion: string,
    dockerPing: () => Promise<boolean>,
    dbPing: () => Promise<{ connected: boolean; latencyMs: number }>,
    seederFn: () => Promise<{ tables: number; records: number }>
  ): Promise<OnboardingReport> {
    const env = await this.checkEnvironment(nodeVersion, dockerPing, dbPing);
    let seed: SeedResult = { success: false, tablesSeeded: 0, recordsInserted: 0, durationMs: 0 };

    if (env.databaseConnected) {
      seed = await this.seedLocalFixtures(seederFn);
    }

    const isReady = env.nodeValid && env.dockerActive && env.databaseConnected && seed.success;
    const summaryMessage = isReady
      ? 'Development environment successfully validated and local fixtures seeded. Ready to code!'
      : 'Environment validation encountered warnings or failures. Review diagnostic report.';

    return {
      timestamp: Date.now(),
      environment: env,
      seed,
      isReady,
      summaryMessage
    };
  }
}
