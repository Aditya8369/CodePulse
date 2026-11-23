import { WebRtcSignalingGateway, DEFAULT_ICE_SERVERS } from './webrtc-signaling.gateway';

describe('WebRtcSignalingGateway (#1052)', () => {
  let gateway: WebRtcSignalingGateway;
  let mockServer: any;

  beforeEach(() => {
    gateway = new WebRtcSignalingGateway();
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    gateway.server = mockServer;
  });

  it('handles peer join and sends room metadata with STUN/TURN ICE config', () => {
    const mockSocket = {
      id: 'socket-peer-1',
      join: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    } as any;

    gateway.handleJoin(mockSocket, {
      battleId: 'battle-1052',
      userId: 'user-1',
      username: 'CodeWarrior',
    });

    expect(mockSocket.join).toHaveBeenCalledWith('battle-1052');
    expect(mockSocket.emit).toHaveBeenCalledWith('webrtc:room-joined', {
      peerId: 'socket-peer-1',
      battleId: 'battle-1052',
      peers: [],
      iceServers: DEFAULT_ICE_SERVERS,
    });
    expect(gateway.getRoomPeerCount('battle-1052')).toBe(1);
  });

  it('forwards SDP offer directly to target peer', () => {
    const mockSocket = {
      id: 'socket-peer-1',
    } as any;

    gateway.handleOffer(mockSocket, {
      battleId: 'battle-1052',
      targetId: 'socket-peer-2',
      sdp: { type: 'offer', sdp: 'v=0\r\no=...' },
    });

    expect(mockServer.to).toHaveBeenCalledWith('socket-peer-2');
    expect(mockServer.emit).toHaveBeenCalledWith('webrtc:offer', {
      senderId: 'socket-peer-1',
      battleId: 'battle-1052',
      sdp: { type: 'offer', sdp: 'v=0\r\no=...' },
    });
  });

  it('forwards ICE candidate for NAT traversal', () => {
    const mockSocket = {
      id: 'socket-peer-1',
    } as any;

    gateway.handleIceCandidate(mockSocket, {
      battleId: 'battle-1052',
      targetId: 'socket-peer-2',
      candidate: {
        candidate: 'candidate:1 1 UDP ...',
        sdpMid: 'audio',
        sdpMLineIndex: 0,
      },
    });

    expect(mockServer.to).toHaveBeenCalledWith('socket-peer-2');
    expect(mockServer.emit).toHaveBeenCalledWith('webrtc:ice-candidate', {
      senderId: 'socket-peer-1',
      battleId: 'battle-1052',
      candidate: {
        candidate: 'candidate:1 1 UDP ...',
        sdpMid: 'audio',
        sdpMLineIndex: 0,
      },
    });
  });

  it('cleans up peer on disconnect', () => {
    const mockSocket = {
      id: 'socket-peer-1',
      join: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    } as any;

    gateway.handleJoin(mockSocket, {
      battleId: 'battle-1052',
      userId: 'user-1',
      username: 'CodeWarrior',
    });
    expect(gateway.getRoomPeerCount('battle-1052')).toBe(1);

    gateway.handleDisconnect(mockSocket);
    expect(gateway.getRoomPeerCount('battle-1052')).toBe(0);
  });
});
