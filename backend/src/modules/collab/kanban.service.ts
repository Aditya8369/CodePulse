import { Injectable, Logger } from '@nestjs/common';

export interface KanbanTask {
  id: string;
  warRoomId: string;
  title: string;
  assigneeUsername?: string;
  column: 'BACKLOG' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
  position: number;
  linkedPrUrl?: string;
}

@Injectable()
export class KanbanService {
  private readonly logger = new Logger(KanbanService.name);

  private static tasks: KanbanTask[] = [
    {
      id: 'task_1',
      warRoomId: 'room_hackathon_alpha',
      title: 'Design responsive HUD for 3D Battle Arena',
      assigneeUsername: 'alexmercer',
      column: 'IN_PROGRESS',
      position: 1,
    },
    {
      id: 'task_2',
      warRoomId: 'room_hackathon_alpha',
      title: 'Implement WebRTC audio mesh network for team chat',
      assigneeUsername: 'sarah_dev',
      column: 'REVIEW',
      position: 1,
      linkedPrUrl: 'https://github.com/CodePulse/CodePulse/pull/795',
    },
    {
      id: 'task_3',
      warRoomId: 'room_hackathon_alpha',
      title: 'Setup automated benchmark scripts',
      column: 'DONE',
      position: 1,
    },
  ];

  async getTasks(warRoomId: string): Promise<KanbanTask[]> {
    return KanbanService.tasks.filter(t => t.warRoomId === warRoomId);
  }

  async moveTask(
    taskId: string,
    targetColumn: KanbanTask['column'],
    newPosition: number
  ): Promise<KanbanTask | null> {
    const task = KanbanService.tasks.find(t => t.id === taskId);
    if (!task) return null;

    task.column = targetColumn;
    task.position = newPosition;

    this.logger.log(`[War Room Kanban] Moved task ${taskId} to ${targetColumn} at position ${newPosition}`);
    return task;
  }
}
