import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';

@Injectable()
export class Oauth2PkceRotationResolverService {
  private readonly codeVerifiers = new Map<string, { verifier: string; challenge: string }>();

  public createChallenge(verifier: string): string {
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    this.codeVerifiers.set(challenge, { verifier, challenge });
    return challenge;
  }

  public verifyChallenge(challenge: string, submittedVerifier: string): boolean {
    const entry = this.codeVerifiers.get(challenge);
    if (!entry) return false;
    this.codeVerifiers.delete(challenge); // Single-use consumption
    return entry.verifier === submittedVerifier;
  }
}
