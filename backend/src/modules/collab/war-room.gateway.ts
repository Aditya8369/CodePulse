import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { KanbanService, KanbanTask } from './kanban.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/war-room',
})
export class WarRoomGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly kanbanService: KanbanService) {}

  @SubscribeMessage('kanban:card_moved')
  async handleCardMoved(
    @MessageBody() payload: { warRoomId: string; taskId: string; targetColumn: KanbanTask['column']; position: number }
  ) {
    const updated = await this.kanbanService.moveTask(
      payload.taskId,
      payload.targetColumn,
      payload.position
    );

    if (updated) {
      this.server.to(payload.warRoomId).emit('kanban:sync', updated);
    }
    return { success: true };
  }
}
