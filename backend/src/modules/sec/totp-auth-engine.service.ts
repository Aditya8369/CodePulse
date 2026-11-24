import crypto from 'crypto';

export class TOTPAuthEngineService {
  public generateCode(secret: string, counter: number): string {
    const hmac = crypto.createHmac('sha1', Buffer.from(secret));
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(counter), 0);
    hmac.update(buf);
    const digest = hmac.digest();
    const offset = digest[digest.length - 1] & 0xf;
    const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
    return String(code).padStart(6, '0');
  }

  public verify(secret: string, inputCode: string, counter: number, driftWindow: number = 1): boolean {
    for (let drift = -driftWindow; drift <= driftWindow; drift++) {
      if (this.generateCode(secret, counter + drift) === inputCode) {
        return true;
      }
    }
    return false;
  }
}
