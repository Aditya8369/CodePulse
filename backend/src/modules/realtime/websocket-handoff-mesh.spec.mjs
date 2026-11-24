import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class WebsocketHandoffMeshService {
  constructor() {
    this.activeTickets = new Map();
  }
  initiateHandoff(socketId, userId, pending, rooms) {
    const ticketId = 'handoff-' + socketId;
    const ctx = {
      ticketId,
      socketId,
      userId,
      pendingMessages: [...pending],
      subscriptionRooms: [...rooms],
    };
    this.activeTickets.set(ticketId, ctx);
    return ctx;
  }
  completeHandoff(ticketId) {
    const ctx = this.activeTickets.get(ticketId);
    if (!ctx) return null;
    this.activeTickets.delete(ticketId);
    return ctx;
  }
}

describe('WebsocketHandoffMeshService (#2115)', () => {
  test('initiates and transfers state ticket with zero dropped messages', () => {
    const handoff = new WebsocketHandoffMeshService();
    const ctx = handoff.initiateHandoff('sock-1', 'user-1', ['msg1', 'msg2'], ['battle-room-1']);
    assert.strictEqual(ctx.pendingMessages.length, 2);

    const received = handoff.completeHandoff(ctx.ticketId);
    assert.strictEqual(received.subscriptionRooms[0], 'battle-room-1');
    assert.strictEqual(received.pendingMessages.length, 2);
  });
});
