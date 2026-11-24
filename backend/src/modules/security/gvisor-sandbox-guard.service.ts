import { Injectable } from '@nestjs/common';

@Injectable()
export class GvisorSandboxGuardService {
  private readonly forbiddenSyscalls = new Set([
    'ptrace', 'sys_chroot', 'reboot', 'kexec_load', 'init_module', 'finit_module', 'bpf'
  ]);

  public validateContainerSyscall(syscallName: string): { allowed: boolean; reason?: string } {
    if (this.forbiddenSyscalls.has(syscallName.toLowerCase())) {
      return { allowed: false, reason: `Restricted kernel syscall ${syscallName} blocked by gVisor runtime policy` };
    }
    return { allowed: true };
  }
}
