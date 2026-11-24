import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';

@Injectable()
export class SessionFixationCookieRotatorService {
  public rotateSessionCookie(oldSessionId: string, userAgent: string, ip: string): { newSessionId: string; fingerprint: string } {
    const newSessionId = `sess_${crypto.randomBytes(32).toString('hex')}`;
    const fingerprint = crypto.createHash('sha256').update(`${userAgent}:${ip}`).digest('hex');
    return { newSessionId, fingerprint };
  }
}
