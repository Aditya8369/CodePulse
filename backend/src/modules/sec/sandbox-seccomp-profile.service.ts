export interface SeccompProfile {
  defaultAction: string;
  architectures: string[];
  syscalls: {
    names: string[];
    action: string;
  }[];
}

export class SandboxSeccompProfileService {
  private blockedSyscalls = [
    'ptrace', 'bpf', 'sys_chroot', 'reboot', 'mount', 'umount2',
    'kexec_load', 'init_module', 'finit_module', 'delete_module'
  ];

  public generateProfile(allowedAdditionalSyscalls: string[] = []): SeccompProfile {
    return {
      defaultAction: 'SCMP_ACT_ERRNO',
      architectures: ['SCMP_ARCH_X86_64', 'SCMP_ARCH_AARCH64'],
      syscalls: [
        {
          names: this.blockedSyscalls,
          action: 'SCMP_ACT_KILL'
        },
        {
          names: [
            'read', 'write', 'openat', 'close', 'fstat', 'mmap', 'mprotect', 'munmap',
            'brk', 'rt_sigaction', 'rt_sigprocmask', 'ioctl', 'nanosleep', 'exit_group',
            ...allowedAdditionalSyscalls
          ],
          action: 'SCMP_ACT_ALLOW'
        }
      ]
    };
  }

  public isSyscallAllowed(syscallName: string, profile: SeccompProfile): boolean {
    const blockedGroup = profile.syscalls.find(g => g.action === 'SCMP_ACT_KILL');
    if (blockedGroup && blockedGroup.names.includes(syscallName)) {
      return false;
    }
    const allowGroup = profile.syscalls.find(g => g.action === 'SCMP_ACT_ALLOW');
    return allowGroup ? allowGroup.names.includes(syscallName) : false;
  }
}
