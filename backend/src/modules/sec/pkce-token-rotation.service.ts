import crypto from 'crypto';

export class PKCETokenRotationService {
  public generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  public verifyChallenge(verifier: string, challenge: string): boolean {
    const expected = this.generateCodeChallenge(verifier);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(challenge));
  }
}
