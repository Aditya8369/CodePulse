/**
 * Client-Side Ephemeral E2EE WebRTC Peer-to-Peer Voice Channel
 *
 * Provides zero-latency direct audio channels and tactical data channels
 * with DTLS-SRTP end-to-end encryption, bypassing backend media proxying.
 */

export interface VoicePeerConnection {
  peerId: string;
  userId: string;
  username: string;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  remoteStream?: MediaStream;
  isMuted: boolean;
  latencyMs: number;
}

export interface VoiceChannelConfig {
  battleId: string;
  userId: string;
  username: string;
  iceServers?: RTCIceServer[];
  onRemoteTrack?: (peerId: string, stream: MediaStream) => void;
  onPeerJoin?: (peer: { peerId: string; userId: string; username: string }) => void;
  onPeerLeave?: (peerId: string) => void;
  onDataMessage?: (peerId: string, message: string) => void;
  onStatsUpdate?: (peerId: string, latencyMs: number) => void;
}

export interface PeerStatsReport {
  peerId: string;
  rttMs: number;
  jitterMs: number;
  packetsLost: number;
  bytesReceived: number;
}

export const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export class WebRtcVoiceChannel {
  private localStream: MediaStream | null = null;
  private readonly peers = new Map<string, VoicePeerConnection>();
  private readonly config: VoiceChannelConfig;
  private isMuted = false;
  private statsIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(config: VoiceChannelConfig) {
    this.config = config;
  }

  /**
   * Initializes local microphone stream with high-performance low-latency constraints.
   */
  async initializeLocalMedia(): Promise<MediaStream> {
    if (this.localStream) {
      return this.localStream;
    }

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 1,
          },
          video: false,
        });
      } catch {
        // Create an empty fallback stream in testing or simulated environments
        this.localStream = new MediaStream();
      }
    } else {
      this.localStream = new MediaStream();
    }

    return this.localStream;
  }

  /**
   * Creates an RTCPeerConnection for a new peer in the voice mesh.
   */
  createPeerConnection(
    peerId: string,
    userId: string,
    username: string,
    onIceCandidateCallback: (candidate: RTCIceCandidate) => void,
  ): RTCPeerConnection {
    const iceServers = this.config.iceServers ?? FALLBACK_ICE_SERVERS;

    const pc = new RTCPeerConnection({
      iceServers,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    // Attach local audio tracks to the peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Set up tactical E2EE DataChannel
    const dataChannel = pc.createDataChannel('tactical-voice-chat', {
      ordered: false,
      maxRetransmits: 0, // Unreliable & unordered for sub-20ms instant delivery
    });

    dataChannel.onmessage = (event) => {
      this.config.onDataMessage?.(peerId, String(event.data));
    };

    // Handle remote incoming audio stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.remoteStream = remoteStream;
      }
      this.config.onRemoteTrack?.(peerId, remoteStream);
    };

    // Forward ICE candidates to signaling gateway
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidateCallback(event.candidate);
      }
    };

    // Handle incoming data channel when initiated by peer
    pc.ondatachannel = (event) => {
      const dc = event.channel;
      dc.onmessage = (msgEvent) => {
        this.config.onDataMessage?.(peerId, String(msgEvent.data));
      };
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.dataChannel = dc;
      }
    };

    const peerConnectionState: VoicePeerConnection = {
      peerId,
      userId,
      username,
      connection: pc,
      dataChannel,
      isMuted: false,
      latencyMs: 0,
    };

    this.peers.set(peerId, peerConnectionState);
    return pc;
  }

  /**
   * Generates and returns an SDP Offer to initiate P2P audio handshake.
   */
  async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error(`Peer ${peerId} connection not found`);
    }

    const offer = await peer.connection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    await peer.connection.setLocalDescription(offer);
    return offer;
  }

  /**
   * Handles incoming SDP Offer and generates matching SDP Answer.
   */
  async handleOffer(
    peerId: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<RTCSessionDescriptionInit> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error(`Peer ${peerId} connection not found`);
    }

    await peer.connection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.connection.createAnswer();
    await peer.connection.setLocalDescription(answer);
    return answer;
  }

  /**
   * Handles incoming SDP Answer confirming P2P handshake.
   */
  async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error(`Peer ${peerId} connection not found`);
    }

    await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  /**
   * Adds an ICE candidate received from peer via signaling server.
   */
  async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error(`Peer ${peerId} connection not found`);
    }

    await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  /**
   * Sends a low-latency tactical message over WebRTC Data Channel.
   */
  sendTacticalData(peerId: string, message: string): boolean {
    const peer = this.peers.get(peerId);
    if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
      peer.dataChannel.send(message);
      return true;
    }
    return false;
  }

  /**
   * Broadcasts tactical message to all connected peers in voice channel.
   */
  broadcastTacticalData(message: string): number {
    let sentCount = 0;
    this.peers.forEach((peer) => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(message);
        sentCount++;
      }
    });
    return sentCount;
  }

  /**
   * Toggles local microphone mute state.
   */
  setMute(isMuted: boolean): void {
    this.isMuted = isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
  }

  /**
   * Returns current mute status.
   */
  getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Collects WebRTC performance metrics (latency, jitter, packet loss).
   */
  async getPeerStats(peerId: string): Promise<PeerStatsReport | null> {
    const peer = this.peers.get(peerId);
    if (!peer) return null;

    try {
      const stats = await peer.connection.getStats();
      let rttMs = 0;
      let jitterMs = 0;
      let packetsLost = 0;
      let bytesReceived = 0;

      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.currentRoundTripTime !== undefined) {
          rttMs = Math.round(report.currentRoundTripTime * 1000);
        }
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          jitterMs = report.jitter ? Math.round(report.jitter * 1000) : 0;
          packetsLost = report.packetsLost ?? 0;
          bytesReceived = report.bytesReceived ?? 0;
        }
      });

      peer.latencyMs = rttMs / 2; // One-way audio latency
      this.config.onStatsUpdate?.(peerId, peer.latencyMs);

      return {
        peerId,
        rttMs,
        jitterMs,
        packetsLost,
        bytesReceived,
      };
    } catch {
      return null;
    }
  }

  /**
   * Removes peer connection when peer leaves.
   */
  removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      try {
        peer.dataChannel?.close();
        peer.connection.close();
      } catch {
        // Ignore close errors
      }
      this.peers.delete(peerId);
      this.config.onPeerLeave?.(peerId);
    }
  }

  /**
   * Cleans up all peer connections and local media streams.
   */
  destroy(): void {
    if (this.statsIntervalId) {
      clearInterval(this.statsIntervalId);
      this.statsIntervalId = null;
    }

    this.peers.forEach((peer) => {
      try {
        peer.dataChannel?.close();
        peer.connection.close();
      } catch {
        // Ignore close errors
      }
    });
    this.peers.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }
}
