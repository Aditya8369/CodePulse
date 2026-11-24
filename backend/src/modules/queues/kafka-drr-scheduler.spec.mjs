import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class KafkaDRRSchedulerService {
  constructor(baseQuantumBytes = 1024) {
    this.baseQuantum = baseQuantumBytes;
    this.tenants = new Map();
    this.activeTenantList = [];
  }
  registerTenant(tenantId, weight = 1) {
    if (!this.tenants.has(tenantId)) {
      this.tenants.set(tenantId, {
        tenantId,
        quantum: Math.max(1, weight) * this.baseQuantum,
        deficit: 0,
        queue: []
      });
      this.activeTenantList.push(tenantId);
    }
  }
  enqueueMessage(packet) {
    this.registerTenant(packet.tenantId);
    this.tenants.get(packet.tenantId).queue.push(packet);
  }
  scheduleRound(maxBatchBytes = 4096) {
    const scheduled = [];
    let scheduledBytes = 0;
    for (const tenantId of this.activeTenantList) {
      const state = this.tenants.get(tenantId);
      if (!state || state.queue.length === 0) {
        if (state) state.deficit = 0;
        continue;
      }
      state.deficit += state.quantum;
      while (state.queue.length > 0) {
        const nextPacket = state.queue[0];
        if (nextPacket.sizeBytes <= state.deficit) {
          if (scheduledBytes + nextPacket.sizeBytes > maxBatchBytes && scheduled.length > 0) break;
          state.deficit -= nextPacket.sizeBytes;
          scheduled.push(state.queue.shift());
          scheduledBytes += nextPacket.sizeBytes;
        } else {
          break;
        }
      }
    }
    return scheduled;
  }
  getPendingCount(tenantId) {
    if (tenantId) return this.tenants.get(tenantId)?.queue.length || 0;
    let t = 0;
    for (const s of this.tenants.values()) t += s.queue.length;
    return t;
  }
}

describe('KafkaDRRSchedulerService (Issue #1791)', () => {
  it('should fairly schedule messages across low and high volume tenants preventing starvation', () => {
    const scheduler = new KafkaDRRSchedulerService(500); // 500 bytes base quantum
    scheduler.registerTenant('tenant-small', 1); // 500 quantum
    scheduler.registerTenant('tenant-large', 2); // 1000 quantum

    // small tenant pushes 1 message of 300 bytes
    scheduler.enqueueMessage({ id: 'msg-s1', tenantId: 'tenant-small', sizeBytes: 300, payload: 'data' });

    // large tenant pushes 5 messages of 400 bytes
    for (let i = 1; i <= 5; i++) {
      scheduler.enqueueMessage({ id: 'msg-l' + i, tenantId: 'tenant-large', sizeBytes: 400, payload: 'bulk' });
    }

    const round1 = scheduler.scheduleRound(3000);
    assert.equal(round1.some(m => m.id === 'msg-s1'), true, 'Small tenant must get fair turn');
    assert.equal(round1.filter(m => m.tenantId === 'tenant-large').length, 2, 'Large tenant gets up to quantum allocation');
    assert.equal(scheduler.getPendingCount('tenant-small'), 0);
    assert.equal(scheduler.getPendingCount('tenant-large'), 3);
  });
});
