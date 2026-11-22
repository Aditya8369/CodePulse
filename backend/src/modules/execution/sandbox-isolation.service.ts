import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { OtelTracerService } from '../../common/observability/otel-tracer.service';

export interface CgroupLimits {
  cpuQuotaUs: number; // e.g. 100000 -> 100% of 1 core (cpu.max = "100000 100000")
  cpuPeriodUs: number; // 100000
  memoryMaxBytes: number; // 128 * 1024 * 1024 (128MB)
  memoryHighBytes: number; // 112 * 1024 * 1024 (throttling threshold)
  pidsMax: number; // 32 max processes (anti-fork bomb)
}

export interface SandboxSecuritySpec {
  sandboxId: string;
  image: string;
  networkMode: 'none' | 'host' | 'bridge';
  readOnlyRootfs: boolean;
  tmpfsMounts: string[]; // e.g. ['/tmp:rw,noexec,nosuid,size=32m', '/run:rw,noexec,nosuid,size=16m']
  cgroups: CgroupLimits;
  seccompProfilePath: string;
  dropCapabilities: string[]; // ['ALL']
  noNewPrivileges: boolean;
  timeoutSeconds: number; // default 2s CPU quota
}

export interface SandboxExecutionCommand {
  command: string;
  args: string[];
  dockerArgs: string[];
  cgroupConfigSnippet: Record<string, string>;
}

export interface SecurityViolationAnalysis {
  isViolation: boolean;
  violationType?:
    | 'NETWORK_ATTEMPT'
    | 'FORK_BOMB'
    | 'PRIVILEGE_ESCALATION'
    | 'ROOT_WRITE'
    | 'RESOURCE_LIMIT';
  blockedSyscall?: string;
  signal?: 'SIGSYS' | 'SIGKILL' | 'SIGSEGV';
  reason?: string;
}

export interface SandboxRunResult {
  sandboxId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  memoryPeakBytes: number;
  killedBySecurity: boolean;
  violation?: SecurityViolationAnalysis;
}

@Injectable()
export class SandboxIsolationService {
  private readonly logger = new Logger(SandboxIsolationService.name);

  // Hardened default resource limits matching Issue #476 requirements
  public static readonly DEFAULT_CGROUP_LIMITS: CgroupLimits = {
    cpuQuotaUs: 100000, // 1.0 CPU max
    cpuPeriodUs: 100000,
    memoryMaxBytes: 128 * 1024 * 1024, // 128MB RAM ceiling
    memoryHighBytes: 112 * 1024 * 1024,
    pidsMax: 32, // anti-fork-bomb process limit
  };

  public static readonly DEFAULT_SECCOMP_PROFILE_PATH = path.resolve(
    __dirname,
    '../../../../deploy/sandbox/seccomp-profile.json',
  );

  /**
   * Generates a fully-isolated sandbox security configuration.
   */
  createSandboxSpec(
    sandboxId: string,
    image = 'ghcr.io/codepulse/execution-sandbox:latest',
    options?: Partial<SandboxSecuritySpec>,
  ): SandboxSecuritySpec {
    return {
      sandboxId,
      image,
      networkMode: 'none', // --net=none makes outbound network access physically impossible
      readOnlyRootfs: true, // --read-only root filesystem prevents host and container tampering
      tmpfsMounts: [
        '/tmp:rw,noexec,nosuid,size=32m', // Ephemeral scratch space
        '/run:rw,noexec,nosuid,size=16m',
      ],
      cgroups: options?.cgroups || {
        ...SandboxIsolationService.DEFAULT_CGROUP_LIMITS,
      },
      seccompProfilePath:
        options?.seccompProfilePath ||
        SandboxIsolationService.DEFAULT_SECCOMP_PROFILE_PATH,
      dropCapabilities: ['ALL'], // Drop all Linux capabilities
      noNewPrivileges: true, // Disallow setuid/privilege escalation
      timeoutSeconds: options?.timeoutSeconds ?? 2, // 2-second strict CPU execution timeout
    };
  }

  /**
   * Builds container CLI arguments for container runtime engines (Docker/Podman/runC/crictl)
   * enforcing Linux namespaces, Cgroups v2, and Seccomp filters.
   */
  buildContainerExecutionArgs(
    spec: SandboxSecuritySpec,
    entrypoint: string,
    codeArgs: string[] = [],
  ): SandboxExecutionCommand {
    const dockerArgs: string[] = [
      'run',
      '--rm',
      `--name=sandbox-${spec.sandboxId}`,
      // 1. Network Namespace Isolation
      `--network=${spec.networkMode}`,
      // 2. Read-only Root Filesystem & Tmpfs Scratch
      ...(spec.readOnlyRootfs ? ['--read-only'] : []),
      ...spec.tmpfsMounts.map((mount) => `--tmpfs=${mount}`),
      // 3. Linux Capabilities & Privilege Escalation
      ...spec.dropCapabilities.map((cap) => `--cap-drop=${cap}`),
      ...(spec.noNewPrivileges
        ? ['--security-opt=no-new-privileges:true']
        : []),
      // 4. Seccomp BPF Syscall Filter
      `--security-opt=seccomp=${spec.seccompProfilePath}`,
      // 5. Cgroups v2 Resource Quotas
      `--cpu-quota=${spec.cgroups.cpuQuotaUs}`,
      `--cpu-period=${spec.cgroups.cpuPeriodUs}`,
      `--memory=${spec.cgroups.memoryMaxBytes}b`,
      `--memory-reservation=${spec.cgroups.memoryHighBytes}b`,
      `--pids-limit=${spec.cgroups.pidsMax}`,
      // Target image and user command
      spec.image,
      entrypoint,
      ...codeArgs,
    ];

    const cgroupConfigSnippet: Record<string, string> = {
      'cpu.max': `${spec.cgroups.cpuQuotaUs} ${spec.cgroups.cpuPeriodUs}`,
      'memory.max': `${spec.cgroups.memoryMaxBytes}`,
      'memory.high': `${spec.cgroups.memoryHighBytes}`,
      'pids.max': `${spec.cgroups.pidsMax}`,
    };

    return {
      command: 'docker',
      args: dockerArgs,
      dockerArgs,
      cgroupConfigSnippet,
    };
  }

  /**
   * Inspects code or execution traces for malicious exploit patterns:
   * 1. Fork bombs (e.g. :(){ :|:& };: or while(1) fork())
   * 2. Socket and network attempts
   * 3. Privilege escalation or sensitive filesystem access (/etc/shadow, /proc/sys, ptrace)
   */
  analyzeCodeSecurity(sourceCode: string): SecurityViolationAnalysis {
    // 1. Check fork bombs
    const forkBombPatterns = [
      /:(){ :|:& };:/,
      /while\s*\(\s*1\s*\)\s*fork\s*\(\s*\)/,
      /for\s*\(\s*;\s*;\s*\)\s*fork\s*\(\s*\)/,
      /os\.fork\(\)\s*while\s*True/,
      /process\.fork\s*\(/,
    ];

    for (const pattern of forkBombPatterns) {
      if (pattern.test(sourceCode)) {
        return {
          isViolation: true,
          violationType: 'FORK_BOMB',
          blockedSyscall: 'clone',
          signal: 'SIGSYS',
          reason:
            'Fork-bomb pattern detected. Blocked by pids.max=32 and clone syscall restriction.',
        };
      }
    }

    // 2. Check network / socket calls
    const networkPatterns = [
      /import\s+socket/,
      /require\s*\(\s*['"]net['"]\s*\)/,
      /require\s*\(\s*['"]http['"]\s*\)/,
      /socket\s*\(/,
      /connect\s*\(/,
      /curl\s+http/,
      /wget\s+http/,
      /nc\s+-e/,
    ];

    for (const pattern of networkPatterns) {
      if (pattern.test(sourceCode)) {
        return {
          isViolation: true,
          violationType: 'NETWORK_ATTEMPT',
          blockedSyscall: 'socket',
          signal: 'SIGSYS',
          reason:
            'Network socket initialization attempted in unshared network namespace (--net=none). Blocked by Seccomp.',
        };
      }
    }

    // 3. Check privilege escalation or sensitive file write attempts
    const privilegePatterns = [
      /ptrace\s*\(/,
      /\/etc\/shadow/,
      /\/etc\/passwd/,
      /\/proc\/sys/,
      /chmod\s+777/,
      /sudo\s+/,
    ];

    for (const pattern of privilegePatterns) {
      if (pattern.test(sourceCode)) {
        return {
          isViolation: true,
          violationType: 'PRIVILEGE_ESCALATION',
          blockedSyscall: 'ptrace',
          signal: 'SIGSYS',
          reason:
            'Privilege escalation or sensitive host probe blocked by Seccomp and read-only rootfs.',
        };
      }
    }

    return { isViolation: false };
  }

  /**
   * Simulates/evaluates container execution output to verify that violations
   * are terminated immediately with SIGSYS or exit codes matching kernel sandboxing.
   */
  evaluateProcessOutcome(
    sandboxId: string,
    exitCode: number,
    stderr: string,
    memoryUsedBytes = 0,
    elapsedMs = 0,
  ): SandboxRunResult {
    let violation: SecurityViolationAnalysis | undefined;
    let killedBySecurity = false;

    // Check for Seccomp violation (Signal 31 is SIGSYS; 128 + 31 = 159 in Linux shells)
    if (
      exitCode === 159 ||
      stderr.includes('Bad system call') ||
      stderr.includes('SIGSYS')
    ) {
      killedBySecurity = true;
      violation = {
        isViolation: true,
        violationType: 'PRIVILEGE_ESCALATION',
        signal: 'SIGSYS',
        reason:
          'Process terminated immediately by Seccomp BPF filter with SIGSYS (exit 159).',
      };
    } else if (
      exitCode === 137 ||
      memoryUsedBytes >
        SandboxIsolationService.DEFAULT_CGROUP_LIMITS.memoryMaxBytes
    ) {
      // Memory OOMKilled (Signal 9 SIGKILL; 128 + 9 = 137)
      killedBySecurity = true;
      violation = {
        isViolation: true,
        violationType: 'RESOURCE_LIMIT',
        signal: 'SIGKILL',
        reason:
          'Process terminated by Cgroups v2 memory.max ceiling (128MB limit exceeded).',
      };
    } else if (
      stderr.includes('Resource temporarily unavailable') ||
      stderr.includes('pids limit')
    ) {
      killedBySecurity = true;
      violation = {
        isViolation: true,
        violationType: 'FORK_BOMB',
        signal: 'SIGKILL',
        reason: 'Process fork flood blocked by Cgroups v2 pids.max=32 quota.',
      };
    } else if (stderr.includes('Read-only file system')) {
      killedBySecurity = true;
      violation = {
        isViolation: true,
        violationType: 'ROOT_WRITE',
        reason: 'Attempted write to read-only container rootfs blocked.',
      };
    }

    return {
      sandboxId,
      exitCode,
      stdout: killedBySecurity ? '' : 'Execution successful',
      stderr,
      executionTimeMs: elapsedMs,
      memoryPeakBytes: memoryUsedBytes,
      killedBySecurity,
      violation,
    };
  }

  /**
   * Profiles compile phase vs test evaluation execution using custom OpenTelemetry spans.
   */
  async executeSubprocessWithTracing<T>(
    phase: 'compile' | 'test_eval',
    metadata: {
      sandboxId?: string;
      language?: string;
      submissionId?: string;
    },
    fn: () => Promise<T>,
  ): Promise<T> {
    return OtelTracerService.getInstance().measureExecutionSubprocess(
      phase,
      {
        language: metadata.language,
        submissionId: metadata.submissionId,
      },
      fn,
    );
  }
}
