import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtRevocationBloomFilterService {
  private readonly bitset = new Uint8Array(1024);

  public revokeJti(jti: string): void {
    const idx = this.hash(jti) % (1024 * 8);
    this.bitset[Math.floor(idx / 8)] |= (1 << (idx % 8));
  }

  public isPossiblyRevoked(jti: string): boolean {
    const idx = this.hash(jti) % (1024 * 8);
    return (this.bitset[Math.floor(idx / 8)] & (1 << (idx % 8))) !== 0;
  }

  private hash(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return Math.abs(hash);
  }
}
