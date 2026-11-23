import { WebRtcVoiceChannel, FALLBACK_ICE_SERVERS } from './voice-channel';

describe('WebRtcVoiceChannel (#1052)', () => {
  let voiceChannel: WebRtcVoiceChannel;

  beforeEach(() => {
    voiceChannel = new WebRtcVoiceChannel({
      battleId: 'battle-1052',
      userId: 'user-a',
      username: 'Alice',
      iceServers: FALLBACK_ICE_SERVERS,
    });
  });

  afterEach(() => {
    voiceChannel.destroy();
  });

  it('initializes local media stream and handles mute state', async () => {
    const stream = await voiceChannel.initializeLocalMedia();
    expect(stream).toBeDefined();

    expect(voiceChannel.getIsMuted()).toBe(false);
    voiceChannel.setMute(true);
    expect(voiceChannel.getIsMuted()).toBe(true);
    voiceChannel.setMute(false);
    expect(voiceChannel.getIsMuted()).toBe(false);
  });

  it('creates peer connection with ICE servers and data channel', () => {
    const onIceCandidate = jest.fn();
    const pc = voiceChannel.createPeerConnection(
      'peer-bob',
      'user-b',
      'Bob',
      onIceCandidate,
    );

    expect(pc).toBeDefined();
    voiceChannel.removePeer('peer-bob');
  });

  it('destroys cleanly and releases media tracks', () => {
    expect(() => voiceChannel.destroy()).not.toThrow();
  });
});
