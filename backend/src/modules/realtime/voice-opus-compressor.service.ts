import { Injectable } from '@nestjs/common';

export interface AudioPacket {
  streamId: string;
  energyLevelRms: number;
  rawPcmBuffer: Buffer;
}

@Injectable()
export class VoiceOpusCompressorService {
  private readonly silenceThresholdRms = 0.015;

  public isSilence(packet: AudioPacket): boolean {
    return packet.energyLevelRms < this.silenceThresholdRms;
  }

  public processAudioStream(packet: AudioPacket): { forward: boolean; compressedSize: number } {
    if (this.isSilence(packet)) {
      // Suppress silence packet to save 80% upstream bandwidth
      return { forward: false, compressedSize: 0 };
    }

    // Emulate Opus variable bitrate encoding compression (typical 6:1 ratio over raw PCM)
    const compressedSize = Math.max(20, Math.floor(packet.rawPcmBuffer.length / 6));
    return { forward: true, compressedSize };
  }
}
