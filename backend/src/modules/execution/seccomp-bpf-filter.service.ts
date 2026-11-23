import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ContainerSecurityProfile, SandboxViolationReport, SyscallAction } from './seccomp-bpf-filter.types';

@Injectable()
export class SeccompBpfFilterService implements OnModuleDestroy {
  private readonly logger = new Logger(SeccompBpfFilterService.name);

  private readonly blockedSyscalls = new Set<string>([
    'ptrace',
    'sys_chroot',
    'reboot',
    'socket',
    'connect',
    'bind',
    'listen',
    'mount',
    'umount2',
    'init_module',
    'finit_module',
  ]);

  private readonly allowedSyscalls = new Set<string>([
    'read',
    'write',
    'openat',
    'close',
    'fstat',
    'mmap',
    'mprotect',
    'munmap',
    'brk',
    'exit_group',
  ]);

  private readonly violations: SandboxViolationReport[] = [];

  constructor() {}

  public onModuleDestroy(): void {
    this.violations.length = 0;
  }

  /**
   * Generates BPF filter bytecode specification for untrusted C++ execution.
   */
  public generateProfile(profileId = 'strict-cpp-sandbox'): ContainerSecurityProfile {
    return {
      profileId,
      unshareNamespaces: ['PID', 'NET', 'IPC', 'UTS', 'MOUNT'],
      seccompDefaultAction: 'KILL_PROCESS',
      allowedSyscalls: Array.from(this.allowedSyscalls),
      deniedSyscalls: Array.from(this.blockedSyscalls),
      chrootDir: '/var/isolate/root',
    };
  }

  /**
   * Validates syscall invocation against active BPF policy.
   */
  public inspectSyscall(submissionId: string, syscallName: string): SyscallAction {
    if (this.blockedSyscalls.has(syscallName)) {
      this.violations.push({
        timestamp: Date.now(),
        submissionId,
        blockedSyscall: syscallName,
        actionTaken: 'KILL_PROCESS',
      });
      this.logger.warn(`[Seccomp BPF] BLOCKED malicious syscall '${syscallName}' in submission ${submissionId}.`);
      return 'KILL_PROCESS';
    }

    if (this.allowedSyscalls.has(syscallName)) {
      return 'ALLOW';
    }

    return 'ERRNO_EPERM';
  }

  public getViolations(): SandboxViolationReport[] {
    return [...this.violations];
  }
}
