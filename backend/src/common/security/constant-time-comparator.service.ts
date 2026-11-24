import * as crypto from 'crypto';

/**
 * Constant-Time Cryptographic Comparison Utility.
 * Defends against timing attacks by normalizing buffer lengths and executing crypto.timingSafeEqual.
 */
export class ConstantTimeComparator {
  /**
   * Compares two buffers or strings in constant time.
   * If lengths differ, it hashes both with SHA-256 before comparing,
   * completely preventing length-leakage timing attacks while ensuring constant execution time.
   */
  static safeEqual(a: string | Buffer, b: string | Buffer): boolean {
    const bufA = typeof a === 'string' ? Buffer.from(a, 'utf8') : a;
    const bufB = typeof b === 'string' ? Buffer.from(b, 'utf8') : b;

    if (bufA.length !== bufB.length) {
      // Hash both to fixed 32-byte digests to perform constant-time check without length leak
      const hashA = crypto.createHash('sha256').update(bufA).digest();
      const hashB = crypto.createHash('sha256').update(bufB).digest();
      crypto.timingSafeEqual(hashA, hashB);
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Verifies an expected HMAC signature against actual raw payload.
   */
  static verifyHmac(
    expectedSignatureHex: string,
    payload: string | Buffer,
    secret: string,
    algorithm = 'sha256'
  ): boolean {
    const calculatedSignature = crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest('hex');

    return this.safeEqual(expectedSignatureHex, calculatedSignature);
  }
}
