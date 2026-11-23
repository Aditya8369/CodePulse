import { SeccompBpfFilterService } from './seccomp-bpf-filter.service';

describe('SeccompBpfFilterService (Malicious C++ Isolation)', () => {
  let seccomp: SeccompBpfFilterService;

  beforeEach(() => {
    seccomp = new SeccompBpfFilterService();
  });

  afterEach(() => {
    seccomp.onModuleDestroy();
  });

  it('should allow benign syscalls like read, write, exit_group', () => {
    expect(seccomp.inspectSyscall('sub-1', 'read')).toBe('ALLOW');
    expect(seccomp.inspectSyscall('sub-1', 'write')).toBe('ALLOW');
  });

  it('should kill process executing forbidden network syscalls (e.g. socket, connect)', () => {
    const action = seccomp.inspectSyscall('sub-evil', 'socket');
    expect(action).toBe('KILL_PROCESS');
    expect(seccomp.getViolations().length).toBe(1);
    expect(seccomp.getViolations()[0].blockedSyscall).toBe('socket');
  });

  it('should generate profile unsharing network and PID namespaces', () => {
    const profile = seccomp.generateProfile();
    expect(profile.unshareNamespaces).toContain('NET');
    expect(profile.unshareNamespaces).toContain('PID');
    expect(profile.seccompDefaultAction).toBe('KILL_PROCESS');
  });
});
