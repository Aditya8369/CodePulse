import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebRtcBattleMesh } from './webrtc-battle-mesh';

// Mock WebRTC browser primitives
class MockRTCDataChannel {
  public label: string;
  public ordered: boolean;
  public maxRetransmits: number;
  public readyState: 'connecting' | 'open' | 'closing' | 'closed' = 'connecting';
  public onopen: (() => void) | null = null;
  public onclose: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;
  public sentData: string[] = [];

  constructor(label: string, options: { ordered?: boolean; maxRetransmits?: number }) {
    this.label = label;
    this.ordered = options.ordered ?? true;
    this.maxRetransmits = options.maxRetransmits ?? 0;
  }

  send(data: string) {
    this.sentData.push(data);
  }

  close() {
    this.readyState = 'closed';
    this.onclose?.();
  }

  simulateOpen() {
    this.readyState = 'open';
    this.onopen?.();
  }

  simulateMessage(msg: any) {
    this.onmessage?.({ data: typeof msg === 'string' ? msg : JSON.stringify(msg) });
  }
}

class MockRTCPeerConnection {
  public iceConnectionState: RTCIceConnectionState = 'new';
  public onicecandidate: ((event: { candidate: any }) => void) | null = null;
  public oniceconnectionstatechange: (() => void) | null = null;
  public ondatachannel: ((event: { channel: any }) => void) | null = null;
  public localDescription: any = null;
  public remoteDescription: any = null;
  public dataChannels: MockRTCDataChannel[] = [];

  createDataChannel(label: string, options: any) {
    const channel = new MockRTCDataChannel(label, options);
    this.dataChannels.push(channel);
    return channel;
  }

  async createOffer() {
    return { type: 'offer', sdp: 'v=0\r\no=mock 1 1 IN IP4 127.0.0.1\r\n' };
  }

  async createAnswer() {
    return { type: 'answer', sdp: 'v=0\r\no=mock 2 2 IN IP4 127.0.0.1\r\n' };
  }

  async setLocalDescription(desc: any) {
    this.localDescription = desc;
  }

  async setRemoteDescription(desc: any) {
    this.remoteDescription = desc;
  }

  async addIceCandidate(_candidate: any) {}

  close() {
    this.iceConnectionState = 'closed';
  }
}

describe('WebRtcBattleMesh (#529)', () => {
  let originalRTCPeerConnection: any;

  beforeEach(() => {
    vi.useFakeTimers();
    originalRTCPeerConnection = (globalThis as any).RTCPeerConnection;
    (globalThis as any).RTCPeerConnection = MockRTCPeerConnection;
    (globalThis as any).RTCSessionDescription = function (desc: any) {
      return desc;
    };
    (globalThis as any).RTCIceCandidate = function (cand: any) {
      return cand;
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as any).RTCPeerConnection = originalRTCPeerConnection;
  });

  describe('1. Signaling & RTCDataChannel Configuration', () => {
    it('initiator establishes RTCDataChannel with ordered: false and maxRetransmits: 0', async () => {
      const signalingSend = vi.fn();
      const mesh = new WebRtcBattleMesh({
        battleId: 'battle-p2p-101',
        userId: 'user-initiator',
        isInitiator: true,
        signalingSend,
      });

      await mesh.initialize();

      // Verified signaling sent SDP Offer
      expect(signalingSend).toHaveBeenCalledWith(
        'webrtc:p2p_offer',
        expect.objectContaining({
          battleId: 'battle-p2p-101',
          userId: 'user-initiator',
          sdp: expect.objectContaining({ type: 'offer' }),
        }),
      );

      // Access mock peer connection
      const pc = (mesh as any).peerConnection as MockRTCPeerConnection;
      expect(pc.dataChannels).toHaveLength(1);
      const dc = pc.dataChannels[0];

      // Acceptance Criteria: ordered: false, maxRetransmits: 0 for minimal latency
      expect(dc.label).toBe('battle-keystrokes');
      expect(dc.ordered).toBe(false);
      expect(dc.maxRetransmits).toBe(0);

      mesh.destroy();
    });

    it('responder handles SDP offer and emits SDP answer', async () => {
      const signalingSend = vi.fn();
      const mesh = new WebRtcBattleMesh({
        battleId: 'battle-p2p-102',
        userId: 'user-responder',
        isInitiator: false,
        signalingSend,
      });

      await mesh.initialize();

      // Simulate incoming offer from initiator
      await mesh.handleSignal('webrtc:p2p_offer', {
        battleId: 'battle-p2p-102',
        sdp: { type: 'offer', sdp: 'mock-offer' },
      });

      expect(signalingSend).toHaveBeenCalledWith(
        'webrtc:p2p_answer',
        expect.objectContaining({
          battleId: 'battle-p2p-102',
          userId: 'user-responder',
          sdp: expect.objectContaining({ type: 'answer' }),
        }),
      );

      mesh.destroy();
    });
  });

  describe('2. Sub-15ms Keystroke Synchronization', () => {
    it('delivers keystrokes directly over RTCDataChannel when open', async () => {
      const signalingSend = vi.fn();
      const onKeystroke = vi.fn();

      const mesh = new WebRtcBattleMesh({
        battleId: 'battle-p2p-103',
        userId: 'user-p2p-1',
        isInitiator: true,
        signalingSend,
        onKeystroke,
      });

      await mesh.initialize();
      const pc = (mesh as any).peerConnection as MockRTCPeerConnection;
      const dc = pc.dataChannels[0];
      dc.simulateOpen();

      expect(mesh.getMode()).toBe('p2p');

      const keystroke = { delta: 'const x = 10;', cursorPosition: 14 };
      const sentDirect = mesh.sendKeystroke(keystroke);

      expect(sentDirect).toBe(true);
      expect(dc.sentData).toHaveLength(1);
      const parsed = JSON.parse(dc.sentData[0]);
      expect(parsed.delta).toBe('const x = 10;');
      expect(parsed.cursorPosition).toBe(14);
      expect(parsed.p2pTimestamp).toBeDefined();

      // WebSocket relay should NOT have been invoked
      expect(signalingSend).not.toHaveBeenCalledWith('keystroke', expect.anything());

      mesh.destroy();
    });

    it('measures sub-15ms RTT round-trip ping latency', async () => {
      const mesh = new WebRtcBattleMesh({
        battleId: 'battle-p2p-104',
        userId: 'user-p2p-2',
        isInitiator: true,
        signalingSend: vi.fn(),
      });

      await mesh.initialize();
      const pc = (mesh as any).peerConnection as MockRTCPeerConnection;
      const dc = pc.dataChannels[0];
      dc.simulateOpen();

      // Trigger ping interval
      vi.advanceTimersByTime(1100);

      // Verify ping message sent over DataChannel
      const pingMsg = dc.sentData.find((d) => d.includes('__ping__'));
      expect(pingMsg).toBeDefined();

      // Simulate pong return with 12ms latency
      const pingParsed = JSON.parse(pingMsg!);
      const simulatedNow = pingParsed.sentTimestamp + 12;
      vi.setSystemTime(simulatedNow);

      dc.simulateMessage({
        type: '__pong__',
        id: pingParsed.id,
        sentTimestamp: pingParsed.sentTimestamp,
      });

      const diag = mesh.getDiagnostics();
      expect(diag.rttMs).toBeLessThanOrEqual(15);
      expect(diag.isDataChannelOpen).toBe(true);

      mesh.destroy();
    });
  });

  describe('3. Seamless 3-Second Fallback to WebSocket Relay', () => {
    it('seamlessly falls back to WebSocket relay if P2P connection fails within 3 seconds', async () => {
      const onModeChange = vi.fn();
      const signalingSend = vi.fn();

      const mesh = new WebRtcBattleMesh({
        battleId: 'battle-p2p-105',
        userId: 'user-strict-nat',
        isInitiator: true,
        connectionTimeoutMs: 3000,
        signalingSend,
        onModeChange,
      });

      await mesh.initialize();
      expect(mesh.getMode()).toBe('connecting');

      // Advance time by 3 seconds (strict NAT prevents ICE candidate completion)
      vi.advanceTimersByTime(3001);

      expect(mesh.getMode()).toBe('websocket-relay');
      expect(onModeChange).toHaveBeenCalledWith('websocket-relay');
      expect(signalingSend).toHaveBeenCalledWith(
        'webrtc:p2p_fallback_notice',
        expect.objectContaining({
          battleId: 'battle-p2p-105',
          reason: expect.stringContaining('3s SLA'),
        }),
      );

      // Keystrokes during fallback MUST route through WebSocket relay without dropping
      const keystroke = { delta: 'function add() {}' };
      const sentDirect = mesh.sendKeystroke(keystroke);

      expect(sentDirect).toBe(false);
      expect(signalingSend).toHaveBeenCalledWith('keystroke', keystroke);

      mesh.destroy();
    });
  });

  describe('4. Cryptographic SHA-256 State Checkpoints (Zero Desynchronization)', () => {
    it('computes and transmits SHA-256 state hash checkpoints', async () => {
      const signalingSend = vi.fn();
      const mesh = new WebRtcBattleMesh({
        battleId: 'battle-p2p-106',
        userId: 'user-authoritative',
        isInitiator: true,
        signalingSend,
      });

      const code = 'function solve(nums) { return nums.sort(); }';
      const hash = await mesh.sendStateCheckpoint(code, 40);

      expect(hash).toHaveLength(64); // Valid SHA-256 64-char hex
      expect(signalingSend).toHaveBeenCalledWith(
        'webrtc:p2p_state_checkpoint',
        expect.objectContaining({
          battleId: 'battle-p2p-106',
          userId: 'user-authoritative',
          sequence: 40,
          hash,
        }),
      );

      mesh.destroy();
    });

    it('triggers mismatch callback when state desynchronization occurs', async () => {
      const onMismatch = vi.fn();
      const mesh = new WebRtcBattleMesh({
        battleId: 'battle-p2p-107',
        userId: 'user-desync-test',
        isInitiator: true,
        signalingSend: vi.fn(),
        onStateCheckpointMismatch: onMismatch,
      });

      await mesh.initialize();
      await mesh.sendStateCheckpoint('local code', 10);

      // Simulate desync notification from gateway
      await mesh.handleSignal('webrtc:p2p_state_desync', {
        sequence: 10,
        remoteHash: 'remote-divergent-hash-value-123',
      });

      expect(onMismatch).toHaveBeenCalledWith(
        expect.objectContaining({
          sequence: 10,
          remoteHash: 'remote-divergent-hash-value-123',
        }),
      );

      mesh.destroy();
    });
  });
});

