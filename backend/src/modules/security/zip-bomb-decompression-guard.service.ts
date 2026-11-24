import { Injectable } from '@nestjs/common';

@Injectable()
export class ZipBombDecompressionGuardService {
  private readonly maxDecompressedRatio = 100; // Flag if ratio exceeds 100:1
  private readonly maxDecompressedBytes = 10 * 1024 * 1024; // 10MB limit

  public checkDecompressionSafety(compressedBytes: number, decompressedBytes: number): boolean {
    if (decompressedBytes > this.maxDecompressedBytes) return false;
    if (compressedBytes > 0 && (decompressedBytes / compressedBytes) > this.maxDecompressedRatio) {
      return false; // Potential zip bomb detected
    }
    return true;
  }
}
