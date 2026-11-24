import { Injectable } from '@nestjs/common';

@Injectable()
export class AudioSpectrumFourierPipelineService {
  public computeSpectrumBands(samples: number[], bandsCount = 8): number[] {
    const bands = new Array(bandsCount).fill(0);
    const chunkSize = Math.max(1, Math.floor(samples.length / bandsCount));

    for (let i = 0; i < bandsCount; i++) {
      let energy = 0;
      for (let j = 0; j < chunkSize; j++) {
        const idx = i * chunkSize + j;
        if (idx < samples.length) energy += Math.abs(samples[idx]);
      }
      bands[i] = Math.round((energy / chunkSize) * 100);
    }

    return bands;
  }
}
