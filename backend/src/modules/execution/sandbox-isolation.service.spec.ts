import { Test, TestingModule } from '@nestjs/testing';
import {
  SandboxIsolationService,
  SandboxSecuritySpec,
} from './sandbox-isolation.service';
import * as fs from 'fs';

describe('SandboxIsolationService & Linux Hardened Container Sandbox', () => {
  let service: SandboxIsolationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SandboxIsolationService],
    }).compile();

    service = module.get<SandboxIsolationService>(SandboxIsolationService);
  });

  describe('Seccomp Profile Validation', () => {
    it('should have a valid deploy/sandbox/seccomp-profile.json file', () => {
      const profilePath = SandboxIsolationService.DEFAULT_SECCOMP_PROFILE_PATH;
      expect(fs.existsSync(profilePath)).toBe(true);

      const content = fs.readFileSync(profilePath, 'utf8');
      const profile = JSON.parse(content) as {
        defaultAction: string;
        syscalls: Array<{
          names: string[];
          action: string;
        }>;
      };

      expect(profile.defaultAction).toBe('SCMP_ACT_ERRNO');

      // Verify Whitelisted standard computation syscalls
      const allowedGroup = profile.syscalls.find(
        (g) => g.action === 'SCMP_ACT_ALLOW',
      );
      expect(allowedGroup).toBeDefined();
      expect(allowedGroup?.names).toEqual(
        expect.arrayContaining([
          'read',
          'write',
          'exit',
          'brk',
          'mmap',
          'futex',
        ]),
      );

      // Verify Blocked network syscalls
      const blockedNetworkGroup = profile.syscalls.find(
        (g) =>
          g.names.includes('socket') && g.action === 'SCMP_ACT_KILL_PROCESS',
      );
      expect(blockedNetworkGroup).toBeDefined();
      expect(blockedNetworkGroup?.names).toEqual(
        expect.arrayContaining([
          'socket',
          'connect',
          'bind',
          'listen',
          'sendto',
          'recvfrom',
        ]),
      );

      // Verify Blocked privileged syscalls
      const blockedPrivilegedGroup = profile.syscalls.find(
        (g) =>
          g.names.includes('ptrace') && g.action === 'SCMP_ACT_KILL_PROCESS',
      );
      expect(blockedPrivilegedGroup).toBeDefined();
      expect(blockedPrivilegedGroup?.names).toEqual(
        expect.arrayContaining([
          'ptrace',
          'reboot',
          'setns',
          'unshare',
          'mount',
        ]),
      );

      // Verify Blocked fork/clone syscalls
      const blockedCloneGroup = profile.syscalls.find(
        (g) => g.names.includes('clone3') || g.names.includes('clone'),
      );
      expect(blockedCloneGroup).toBeDefined();
      expect(blockedCloneGroup?.action).toBe('SCMP_ACT_KILL_PROCESS');
    });
  });

  describe('Sandbox Spec & Cgroups v2 Quota Configuration', () => {
    it('should generate security spec with strict 128MB RAM, 2s timeout, and unshared network', () => {
      const spec = service.createSandboxSpec('match-1234');

      expect(spec.sandboxId).toBe('match-1234');
      expect(spec.networkMode).toBe('none'); // --net=none
      expect(spec.readOnlyRootfs).toBe(true);
      expect(spec.tmpfsMounts).toContain('/tmp:rw,noexec,nosuid,size=32m');
      expect(spec.dropCapabilities).toEqual(['ALL']);
      expect(spec.noNewPrivileges).toBe(true);
      expect(spec.timeoutSeconds).toBe(2);

      // Cgroups v2 limits
      expect(spec.cgroups.cpuQuotaUs).toBe(100000);
      expect(spec.cgroups.cpuPeriodUs).toBe(100000);
      expect(spec.cgroups.memoryMaxBytes).toBe(128 * 1024 * 1024); // 128MB
      expect(spec.cgroups.pidsMax).toBe(32);
    });

    it('should generate container CLI args with exact flags for namespaces, cgroups, and seccomp', () => {
      const spec: SandboxSecuritySpec = service.createSandboxSpec('runner-99');
      const cmd = service.buildContainerExecutionArgs(spec, 'node', [
        'solution.js',
      ]);

      expect(cmd.command).toBe('docker');
      expect(cmd.dockerArgs).toContain('--network=none');
      expect(cmd.dockerArgs).toContain('--read-only');
      expect(cmd.dockerArgs).toContain(
        '--tmpfs=/tmp:rw,noexec,nosuid,size=32m',
      );
      expect(cmd.dockerArgs).toContain('--cap-drop=ALL');
      expect(cmd.dockerArgs).toContain('--security-opt=no-new-privileges:true');
      expect(cmd.dockerArgs).toContain(
        `--security-opt=seccomp=${spec.seccompProfilePath}`,
      );
      expect(cmd.dockerArgs).toContain('--cpu-quota=100000');
      expect(cmd.dockerArgs).toContain('--cpu-period=100000');
      expect(cmd.dockerArgs).toContain(`--memory=${128 * 1024 * 1024}b`);
      expect(cmd.dockerArgs).toContain('--pids-limit=32');

      // Verify Cgroups v2 snippet
      expect(cmd.cgroupConfigSnippet['cpu.max']).toBe('100000 100000');
      expect(cmd.cgroupConfigSnippet['memory.max']).toBe(
        String(128 * 1024 * 1024),
      );
      expect(cmd.cgroupConfigSnippet['pids.max']).toBe('32');
    });
  });

  describe('Malicious Exploit Detection & Prevention', () => {
    it('should detect fork bomb patterns and indicate clone syscall violation', () => {
      const forkBombCode = `
        #include <unistd.h>
        int main() {
          while(1) fork();
          return 0;
        }
      `;
      const result = service.analyzeCodeSecurity(forkBombCode);

      expect(result.isViolation).toBe(true);
      expect(result.violationType).toBe('FORK_BOMB');
      expect(result.blockedSyscall).toBe('clone');
      expect(result.signal).toBe('SIGSYS');
    });

    it('should detect network socket attempts and indicate unshared network block', () => {
      const networkCode = `
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect(("192.168.1.1", 80))
      `;
      const result = service.analyzeCodeSecurity(networkCode);

      expect(result.isViolation).toBe(true);
      expect(result.violationType).toBe('NETWORK_ATTEMPT');
      expect(result.blockedSyscall).toBe('socket');
      expect(result.signal).toBe('SIGSYS');
    });

    it('should detect privilege escalation / ptrace / sensitive host file probes', () => {
      const exploitCode = `
        cat /etc/shadow
        ptrace(PTRACE_TRACEME, 0, NULL, NULL);
      `;
      const result = service.analyzeCodeSecurity(exploitCode);

      expect(result.isViolation).toBe(true);
      expect(result.violationType).toBe('PRIVILEGE_ESCALATION');
      expect(result.blockedSyscall).toBe('ptrace');
      expect(result.signal).toBe('SIGSYS');
    });

    it('should pass benign computational code without flagging violations', () => {
      const benignCode = `
        function fibonacci(n) {
          if (n <= 1) return n;
          return fibonacci(n - 1) + fibonacci(n - 2);
        }
        console.log(fibonacci(10));
      `;
      const result = service.analyzeCodeSecurity(benignCode);

      expect(result.isViolation).toBe(false);
    });
  });

  describe('Process Outcome Evaluation & Seccomp SIGSYS Termination', () => {
    it('should detect Seccomp SIGSYS termination (exitCode 159 or "Bad system call")', () => {
      const outcome = service.evaluateProcessOutcome(
        'sandbox-1',
        159,
        'Bad system call (core dumped)',
        15 * 1024 * 1024,
        120,
      );

      expect(outcome.killedBySecurity).toBe(true);
      expect(outcome.violation?.isViolation).toBe(true);
      expect(outcome.violation?.signal).toBe('SIGSYS');
      expect(outcome.violation?.reason).toContain(
        'Seccomp BPF filter with SIGSYS',
      );
    });

    it('should detect Cgroups v2 memory limit termination (exitCode 137 or > 128MB RAM)', () => {
      const outcome = service.evaluateProcessOutcome(
        'sandbox-2',
        137,
        'Killed',
        135 * 1024 * 1024, // 135MB > 128MB
        450,
      );

      expect(outcome.killedBySecurity).toBe(true);
      expect(outcome.violation?.violationType).toBe('RESOURCE_LIMIT');
      expect(outcome.violation?.signal).toBe('SIGKILL');
      expect(outcome.violation?.reason).toContain(
        'memory.max ceiling (128MB limit exceeded)',
      );
    });

    it('should detect read-only rootfs write attempts', () => {
      const outcome = service.evaluateProcessOutcome(
        'sandbox-3',
        1,
        'touch: cannot touch "/root/malicious": Read-only file system',
        20 * 1024 * 1024,
        80,
      );

      expect(outcome.killedBySecurity).toBe(true);
      expect(outcome.violation?.violationType).toBe('ROOT_WRITE');
      expect(outcome.violation?.reason).toContain('read-only container rootfs');
    });

    it('should successfully evaluate clean executions', () => {
      const outcome = service.evaluateProcessOutcome(
        'sandbox-clean',
        0,
        '',
        35 * 1024 * 1024,
        250,
      );

      expect(outcome.killedBySecurity).toBe(false);
      expect(outcome.stdout).toBe('Execution successful');
      expect(outcome.violation).toBeUndefined();
    });
  });
});
