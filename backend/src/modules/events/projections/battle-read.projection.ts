import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventStoreService, AuditEventRecord } from '../event-store.service';

export interface BattleReadModel {
  battleId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED';
  participantUserIds: string[];
  totalKeystrokes: number;
  winnerUserId: string | null;
  startedAt: number;
  endedAt: number | null;
  updatedAt: number;
}

@Injectable()
export class BattleReadProjection implements OnModuleInit {
  private readonly readModels = new Map<string, BattleReadModel>();

  constructor(private readonly eventStore: EventStoreService) {}

  onModuleInit() {
    this.eventStore.subscribeAll((event) => this.handleEvent(event));
  }

  public handleEvent(event: AuditEventRecord): void {
    const battleId = event.aggregateId;

    switch (event.eventType) {
      case 'BattleCreated': {
        this.readModels.set(battleId, {
          battleId,
          status: 'PENDING',
          participantUserIds: [],
          totalKeystrokes: 0,
          winnerUserId: null,
          startedAt: event.timestampMs,
          endedAt: null,
          updatedAt: event.timestampMs,
        });
        break;
      }

      case 'PlayerJoined': {
        const model = this.readModels.get(battleId);
        if (model) {
          const userId = event.payload.userId;
          if (!model.participantUserIds.includes(userId)) {
            model.participantUserIds.push(userId);
          }
          model.updatedAt = event.timestampMs;
        }
        break;
      }

      case 'PlayerReady': {
        const model = this.readModels.get(battleId);
        if (model && model.participantUserIds.length >= 2) {
          model.status = 'IN_PROGRESS';
          model.updatedAt = event.timestampMs;
        }
        break;
      }

      case 'KeystrokeBatchRecorded': {
        const model = this.readModels.get(battleId);
        if (model) {
          model.totalKeystrokes += event.payload.count || 1;
          model.updatedAt = event.timestampMs;
        }
        break;
      }

      case 'MatchEnded': {
        const model = this.readModels.get(battleId);
        if (model) {
          model.status = 'COMPLETED';
          model.winnerUserId = event.payload.winnerUserId || null;
          model.endedAt = event.timestampMs;
          model.updatedAt = event.timestampMs;
        }
        break;
      }

      case 'BattleAborted': {
        const model = this.readModels.get(battleId);
        if (model) {
          model.status = 'ABORTED';
          model.endedAt = event.timestampMs;
          model.updatedAt = event.timestampMs;
        }
        break;
      }
    }
  }

  public getBattle(battleId: string): BattleReadModel | undefined {
    return this.readModels.get(battleId);
  }

  public getAllActiveBattles(): BattleReadModel[] {
    return Array.from(this.readModels.values()).filter(
      (m) => m.status === 'PENDING' || m.status === 'IN_PROGRESS',
    );
  }

  public getAllBattles(): BattleReadModel[] {
    return Array.from(this.readModels.values());
  }

  public clear(): void {
    this.readModels.clear();
  }
}
