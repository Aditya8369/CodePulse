import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';

export interface ReconnectionTicket {
  userId: string;
  nonce: string;
  issuedAt: number;
  consumed: boolean;
}

@Injectable()
export class ReconnectionNonceGuardService {
  private readonly tickets = new Map<string, ReconnectionTicket>();
  private readonly ticketTtlMs = 60000;

  public issueNonceTicket(userId: string): string {
    const nonce = crypto.randomBytes(24).toString('hex');
    this.tickets.set(nonce, {
      userId,
      nonce,
      issuedAt: Date.now(),
      consumed: false,
    });
    return nonce;
  }

  public validateAndConsume(nonce: string, userId: string): boolean {
    const ticket = this.tickets.get(nonce);
    if (!ticket) return false;

    if (ticket.consumed || ticket.userId !== userId || Date.now() - ticket.issuedAt > this.ticketTtlMs) {
      this.tickets.delete(nonce);
      return false; // Prevent replay attacks
    }

    ticket.consumed = true;
    this.tickets.delete(nonce);
    return true;
  }
}
