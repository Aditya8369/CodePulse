import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';

export interface SignedFrame {
  sequence: number;
  payload: string;
  signature: string;
  timestamp: number;
}

@Injectable()
export class WebrtcFrameSignerService {
  private readonly sessionSecrets = new Map<string, string>();
  private readonly sessionSequences = new Map<string, number>();

  public establishSessionSecret(sessionId: string): string {
    const secret = crypto.randomBytes(32).toString('hex');
    this.sessionSecrets.set(sessionId, secret);
    this.sessionSequences.set(sessionId, 0);
    return secret;
  }

  public signFrame(sessionId: string, payload: string): SignedFrame {
    const secret = this.sessionSecrets.get(sessionId);
    if (!secret) throw new Error(`Session ${sessionId} not initialized`);

    const seq = (this.sessionSequences.get(sessionId) || 0) + 1;
    this.sessionSequences.set(sessionId, seq);
    const ts = Date.now();

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${seq}:${ts}:${payload}`);
    const signature = hmac.digest('hex');

    return { sequence: seq, payload, signature, timestamp: ts };
  }

  public verifyFrame(sessionId: string, frame: SignedFrame): boolean {
    const secret = this.sessionSecrets.get(sessionId);
    if (!secret) return false;

    const expectedHmac = crypto.createHmac('sha256', secret);
    expectedHmac.update(`${frame.sequence}:${frame.timestamp}:${frame.payload}`);
    const expectedSig = expectedHmac.digest('hex');

    return crypto.timingSafeEqual(Buffer.from(frame.signature, 'hex'), Buffer.from(expectedSig, 'hex'));
  }
}
