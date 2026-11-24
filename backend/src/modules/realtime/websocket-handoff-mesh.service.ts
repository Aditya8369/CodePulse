import { Injectable } from '@nestjs/common';

export interface HandoffContext {
  ticketId: string;
  socketId: string;
  userId: string;
  pendingMessages: string[];
  subscriptionRooms: string[];
  createdTimestamp: number;
}

@Injectable()
export class WebsocketHandoffMeshService {
  private readonly activeTickets = new Map<string, HandoffContext>();

  public initiateHandoff(socketId: string, userId: string, pending: string[], rooms: string[]): HandoffContext {
    const ticketId = `handoff-${socketId}-${Date.now()}`;
    const ctx: HandoffContext = {
      ticketId,
      socketId,
      userId,
      pendingMessages: [...pending],
      subscriptionRooms: [...rooms],
      createdTimestamp: Date.now(),
    };
    this.activeTickets.set(ticketId, ctx);
    return ctx;
  }

  public completeHandoff(ticketId: string): HandoffContext | null {
    const ctx = this.activeTickets.get(ticketId);
    if (!ctx) return null;
    this.activeTickets.delete(ticketId);
    return ctx;
  }
}
