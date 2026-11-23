/**
 * Seccomp-BPF Syscall Filter & Container Namespace Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export type SyscallAction = 'ALLOW' | 'KILL_PROCESS' | 'ERRNO_EPERM' | 'LOG';

export interface SeccompRule {
  syscallName: string;
  syscallNumber: number;
  action: SyscallAction;
}

export interface ContainerSecurityProfile {
  profileId: string;
  unshareNamespaces: ('PID' | 'NET' | 'IPC' | 'UTS' | 'MOUNT')[];
  seccompDefaultAction: SyscallAction;
  allowedSyscalls: string[];
  deniedSyscalls: string[];
  chrootDir: string;
}

export interface SandboxViolationReport {
  timestamp: number;
  submissionId: string;
  blockedSyscall: string;
  actionTaken: SyscallAction;
}
