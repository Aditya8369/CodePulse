import { JailerService } from './jailer.service';

describe('JailerService (Seccomp-BPF and Cgroups v2 Linux Jailer)', () => {
  let jailer: JailerService;

  beforeEach(() => {
    jailer = new JailerService();
  });

  describe('Seccomp-BPF Filter Generation', () => {
    it('generates whitelist with SCMP_ACT_KILL_PROCESS default policy', () => {
      const profile = jailer.generateSeccompBpfProfile();
      expect(profile.defaultAction).toBe('SCMP_ACT_KILL_PROCESS');
      expect(profile.architectures).toContain('SCMP_ARCH_X86_64');

      const allowedNames = profile.syscalls.find((s) => s.action === 'SCMP_ACT_ALLOW')?.names;
      expect(allowedNames).toContain('read');
      expect(allowedNames).toContain('write');
      expect(allowedNames).toContain('exit_group');

      // Network and fork syscalls must NOT be in whitelist
      expect(allowedNames).not.toContain('socket');
      expect(allowedNames).not.toContain('connect');
      expect(allowedNames).not.toContain('clone');
      expect(allowedNames).not.toContain('ptrace');
    });
  });

  describe('Cgroups v2 Resource Governance', () => {
    it('enforces 64M memory cap, 100000 100000 cpu quota, and 32 pids limit', () => {
      const cgroups = jailer.configureCgroupsV2('sandbox-404');
      expect(cgroups.memoryMax).toBe('64M');
      expect(cgroups.cpuMax).toBe('100000 100000');
      expect(cgroups.pidsMax).toBe('32');
    });
  });

  describe('Jail Execution and Exploit Mitigation', () => {
    it('immediately kills socket creation syscall by SIGSYS (exit code 159)', async () => {
      const result = await jailer.executeJailedBinary('/jail/bin/exploit', [], 'SOCKET_CREATE');

      expect(result.exitCode).toBe(159);
      expect(result.signal).toBe('SIGSYS');
      expect(result.killedBySeccomp).toBe(true);
      expect(result.violationSyscall).toBe('socket');
      expect(result.stderr).toContain('Blocked syscall: socket');
    });

    it('immediately kills fork bombs by SIGSYS and enforces cgroup pids cap', async () => {
      const result = await jailer.executeJailedBinary('/jail/bin/forkbomb', [], 'FORK_BOMB');

      expect(result.exitCode).toBe(159);
      expect(result.signal).toBe('SIGSYS');
      expect(result.killedByForkBomb).toBe(true);
      expect(result.violationSyscall).toBe('clone');
      expect(result.stderr).toContain('pids.max (32) exceeded');
    });

    it('runs safe unprivileged binary cleanly inside jail', async () => {
      const result = await jailer.executeJailedBinary('/jail/bin/solution', ['--input', '42']);

      expect(result.exitCode).toBe(0);
      expect(result.killedBySeccomp).toBe(false);
      expect(result.stdout).toContain('completed safely');
      expect(result.memoryPeakBytes).toBeLessThan(64 * 1024 * 1024);
    });
  });
});
