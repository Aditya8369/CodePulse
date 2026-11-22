import { QuicGateway } from './quic-gateway';

describe('QuicGateway (HTTP/3 WebTransport & Head-of-Line Blocking Elimination)', () => {
  let gateway: QuicGateway;

  beforeEach(() => {
    gateway = new QuicGateway();
  });

  afterEach(() => {
    gateway.onModuleDestroy();
  });

  it('accepts and initializes a WebTransport session at edge POP', () => {
    const session = gateway.acceptSession('198.51.100.55', 'EU-Central');
    expect(session.sessionId).toMatch(/^quic-session-/);
    expect(session.edgeRegion).toBe('EU-Central');
    expect(session.rttMs).toBe(25);
  });

  it('guarantees that packet loss on stream 2 does NOT delay or block execution submissions on stream 1', () => {
    const session = gateway.acceptSession('203.0.113.19', 'US-East');

    // Simulate 10 dropped keystroke datagram packets on Stream 2
    for (let i = 0; i < 10; i++) {
      const dropRes = gateway.sendUnreliableKeystroke(
        session.sessionId,
        { key: 'a', cursor: i },
        true, // Simulated packet drop
      );
      expect(dropRes.dropped).toBe(true);
      expect(dropRes.sent).toBe(false);
    }

    // Now submit code execution command on reliable Stream 1
    const commandRes = gateway.sendReliableCommand(session.sessionId, {
      action: 'SUBMIT_CODE',
      battleId: 'battle-quic-1',
      code: 'function solve() { return 42; }',
    });

    // Must be delivered immediately with 0 delay (Head-of-Line blocking eliminated!)
    expect(commandRes.success).toBe(true);
    expect(commandRes.deliveredImmediately).toBe(true);
    expect(commandRes.sequence).toBe(1);

    const stats = gateway.getStats();
    expect(stats.totalDatagramsDropped).toBe(10);
    expect(stats.headOfLineBlocksPrevented).toBe(10);
    expect(stats.totalReliableProcessed).toBe(1);
  });

  it('multiplexes reliable commands and spectator reaction datagrams independently', () => {
    const session = gateway.acceptSession('192.0.2.1', 'AP-South');

    const reactionRes = gateway.sendReactionDatagram(session.sessionId, { emoji: '🔥', count: 5 });
    expect(reactionRes).toBe(true);

    const reliableRes = gateway.sendReliableCommand(session.sessionId, { action: 'JOIN_BATTLE' });
    expect(reliableRes.success).toBe(true);
  });
});
