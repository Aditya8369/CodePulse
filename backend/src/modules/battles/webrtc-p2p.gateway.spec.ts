import { Test, TestingModule } from '@nestjs/testing';
import { BattlesGateway } from './battles.gateway';
import { MetricsService } from '../metrics/metrics.service';

describe('BattlesGateway (WebRTC P2P Signaling & State Checkpoint #529)', () => {
  let gateway: BattlesGateway;

  const mockRoomEmitter = {
    emit: jest.fn(),
  };

  const mockServer = {
    to: jest.fn().mockReturnValue(mockRoomEmitter),
    emit: jest.fn(),
  };

  const mockClient = {
    id: 'socket-peer-1',
    to: jest.fn().mockReturnValue(mockRoomEmitter),
    emit: jest.fn(),
    join: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BattlesGateway,
        {
          provide: MetricsService,
          useValue: {
            socketConnected: jest.fn(),
            socketDisconnected: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<BattlesGateway>(BattlesGateway);
    gateway.server = mockServer as any;
  });

  describe('1. WebRTC Signaling Forwarding', () => {
    it('forwards SDP offer to opponent room channel', () => {
      const offerPayload = {
        battleId: 'b-tournament-1v1',
        userId: 'user-alice',
        sdp: { type: 'offer', sdp: 'mock-sdp-offer' },
      };

      gateway.handleWebRtcP2pOffer(mockClient as any, offerPayload);

      expect(mockClient.to).toHaveBeenCalledWith('battle:b-tournament-1v1');
      expect(mockRoomEmitter.emit).toHaveBeenCalledWith('webrtc:p2p_offer', offerPayload);
    });

    it('forwards SDP answer to opponent room channel', () => {
      const answerPayload = {
        battleId: 'b-tournament-1v1',
        userId: 'user-bob',
        sdp: { type: 'answer', sdp: 'mock-sdp-answer' },
      };

      gateway.handleWebRtcP2pAnswer(mockClient as any, answerPayload);

      expect(mockClient.to).toHaveBeenCalledWith('battle:b-tournament-1v1');
      expect(mockRoomEmitter.emit).toHaveBeenCalledWith('webrtc:p2p_answer', answerPayload);
    });

    it('forwards ICE candidates for peer NAT traversal', () => {
      const icePayload = {
        battleId: 'b-tournament-1v1',
        userId: 'user-alice',
        candidate: { candidate: 'candidate:1 1 UDP ...', sdpMid: '0', sdpMLineIndex: 0 },
      };

      gateway.handleWebRtcP2pIceCandidate(mockClient as any, icePayload);

      expect(mockClient.to).toHaveBeenCalledWith('battle:b-tournament-1v1');
      expect(mockRoomEmitter.emit).toHaveBeenCalledWith('webrtc:p2p_ice_candidate', icePayload);
    });

    it('broadcasts fallback notice when P2P falls back to WebSocket relay', () => {
      const fallbackPayload = {
        battleId: 'b-tournament-1v1',
        userId: 'user-alice',
        reason: 'P2P connection timed out (3s SLA reached)',
      };

      gateway.handleWebRtcP2pFallback(mockClient as any, fallbackPayload);

      expect(mockClient.to).toHaveBeenCalledWith('battle:b-tournament-1v1');
      expect(mockRoomEmitter.emit).toHaveBeenCalledWith('webrtc:p2p_fallback_notice', fallbackPayload);
    });
  });

  describe('2. Cryptographic SHA-256 State Hash Verification (Zero Desynchronization)', () => {
    const battleId = 'b-state-verify';
    const sequence = 20;
    const authoritativeHash = 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef';

    it('verifies synchronized state when both peers submit matching SHA-256 hashes', () => {
      // Player 1 submits hash
      gateway.handleWebRtcStateCheckpoint(mockClient as any, {
        battleId,
        userId: 'user-alice',
        sequence,
        hash: authoritativeHash,
        timestamp: Date.now(),
      });

      // Still waiting for Player 2
      expect(mockServer.to).not.toHaveBeenCalled();

      // Player 2 submits matching hash
      gateway.handleWebRtcStateCheckpoint(mockClient as any, {
        battleId,
        userId: 'user-bob',
        sequence,
        hash: authoritativeHash,
        timestamp: Date.now(),
      });

      // Gateway verifies matching hashes and broadcasts state confirmation
      expect(mockServer.to).toHaveBeenCalledWith(`battle:${battleId}`);
      expect(mockRoomEmitter.emit).toHaveBeenCalledWith('webrtc:p2p_state_verified', {
        battleId,
        sequence,
        verified: true,
        hash: authoritativeHash,
      });
    });

    it('detects state desynchronization when peers submit divergent SHA-256 hashes', () => {
      const divergentSeq = 35;
      const hashAlice = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const hashBob = '0000000000000000000000000000000000000000000000000000000000000000';

      // Alice submits hash
      gateway.handleWebRtcStateCheckpoint(mockClient as any, {
        battleId,
        userId: 'user-alice',
        sequence: divergentSeq,
        hash: hashAlice,
        timestamp: Date.now(),
      });

      // Bob submits mismatched hash
      gateway.handleWebRtcStateCheckpoint(mockClient as any, {
        battleId,
        userId: 'user-bob',
        sequence: divergentSeq,
        hash: hashBob,
        timestamp: Date.now(),
      });

      // Gateway detects mismatch and broadcasts desync notification
      expect(mockServer.to).toHaveBeenCalledWith(`battle:${battleId}`);
      expect(mockRoomEmitter.emit).toHaveBeenCalledWith('webrtc:p2p_state_desync', {
        battleId,
        sequence: divergentSeq,
        verified: false,
        hashes: {
          'user-alice': hashAlice,
          'user-bob': hashBob,
        },
      });
    });
  });
});

