import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

export interface RealtimeNotification {
  id: string;
  userId: string;
  type: 'BATTLE_INVITE' | 'NEW_FOLLOWER' | 'ACHIEVEMENT_UNLOCKED' | 'STREAK_WARNING';
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private userSockets: Map<string, string[]> = new Map(); // userId -> socketIds

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      const existing = this.userSockets.get(userId) || [];
      this.userSockets.set(userId, [...existing, client.id]);
      this.logger.log(`Client connected: ${client.id} for user ${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    for (const [userId, sockets] of this.userSockets.entries()) {
      const filtered = sockets.filter(id => id !== client.id);
      if (filtered.length > 0) {
        this.userSockets.set(userId, filtered);
      } else {
        this.userSockets.delete(userId);
      }
    }
  }

  /**
   * Broadcasts real-time notification event to user's active sockets
   */
  dispatchToUser(userId: string, notification: RealtimeNotification) {
    const socketIds = this.userSockets.get(userId) || [];
    for (const socketId of socketIds) {
      this.server.to(socketId).emit('notification', notification);
    }
  }
}
