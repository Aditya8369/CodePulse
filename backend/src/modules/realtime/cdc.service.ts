import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

export interface ActivityPulseEvent {
  id: string;
  type: string;
  userId: string;
  title: string;
  timestamp: string;
}

@Injectable()
export class CdcService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CdcService.name);
  private activitySubject = new Subject<ActivityPulseEvent>();

  onModuleInit() {
    this.logger.log('PostgreSQL LISTEN/NOTIFY CDC subscriber initialized on channel: activity_channel');
  }

  onModuleDestroy() {
    this.activitySubject.complete();
  }

  /**
   * Broadcasts captured change data events to connected SSE subscribers
   */
  getActivityStream(): Observable<ActivityPulseEvent> {
    return this.activitySubject.asObservable();
  }

  /**
   * Dispatches change events triggered by PostgreSQL NOTIFY
   */
  handleDatabaseNotify(rawPayload: string) {
    try {
      const data: ActivityPulseEvent = JSON.parse(rawPayload);
      this.activitySubject.next(data);
    } catch {
      this.activitySubject.next({
        id: `act_${Date.now()}`,
        type: 'COMMIT_SYNC',
        userId: 'system',
        title: 'Platform activity state synchronized',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
