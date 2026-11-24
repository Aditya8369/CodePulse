import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class SandboxSeccompProfileService {
  constructor() {
    this.blocked = ['ptrace', 'bpf', 'sys_chroot', 'reboot', 'mount'];
  }
  generateProfile(allowed = []) {
    return {
      defaultAction: 'SCMP_ACT_ERRNO',
      syscalls: [
        { names: this.blocked, action: 'SCMP_ACT_KILL' },
        { names: ['read', 'write', 'openat', 'close', 'exit_group', ...allowed], action: 'SCMP_ACT_ALLOW' }
      ]
    };
  }
  isSyscallAllowed(name, profile) {
    const blocked = profile.syscalls.find(g => g.action === 'SCMP_ACT_KILL');
    if (blocked && blocked.names.includes(name)) return false;
    const allowed = profile.syscalls.find(g => g.action === 'SCMP_ACT_ALLOW');
    return allowed ? allowed.names.includes(name) : false;
  }
}

describe('SandboxSeccompProfileService (Issue #1861)', () => {
  it('should generate strict Seccomp BPF profiles and deny hazardous syscalls', () => {
    const service = new SandboxSeccompProfileService();
    const profile = service.generateProfile(['fork']);

    assert.equal(profile.defaultAction, 'SCMP_ACT_ERRNO');
    assert.equal(service.isSyscallAllowed('read', profile), true);
    assert.equal(service.isSyscallAllowed('fork', profile), true);
    assert.equal(service.isSyscallAllowed('ptrace', profile), false, 'ptrace must be blocked');
    assert.equal(service.isSyscallAllowed('reboot', profile), false, 'reboot must be blocked');
  });
});
