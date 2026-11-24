export interface StreamEvent {
  aggregateId: string;
  version: number;
  eventType: string;
  payload: Record<string, any>;
}

export interface MaterializedView {
  aggregateId: string;
  version: number;
  data: Record<string, any>;
}

export interface AuditReport {
  aggregateId: string;
  inSync: boolean;
  eventStoreVersion: number;
  projectionVersion: number;
  diverged: boolean;
  replayedEventsCount: number;
}

export class CQRSProjectionAuditorService {
  public auditAndRepair(
    eventLog: StreamEvent[],
    currentView: MaterializedView | null,
    projectionReducer: (acc: Record<string, any>, evt: StreamEvent) => Record<string, any>
  ): { updatedView: MaterializedView; report: AuditReport } {
    if (eventLog.length === 0) {
      return {
        updatedView: currentView || { aggregateId: 'unknown', version: 0, data: {} },
        report: {
          aggregateId: currentView?.aggregateId || 'unknown',
          inSync: true,
          eventStoreVersion: 0,
          projectionVersion: currentView?.version || 0,
          diverged: false,
          replayedEventsCount: 0
        }
      };
    }

    const latestEvent = eventLog[eventLog.length - 1];
    const aggregateId = latestEvent.aggregateId;
    const currentVersion = currentView?.version || 0;

    if (currentView && currentView.version === latestEvent.version) {
      return {
        updatedView: currentView,
        report: {
          aggregateId,
          inSync: true,
          eventStoreVersion: latestEvent.version,
          projectionVersion: currentVersion,
          diverged: false,
          replayedEventsCount: 0
        }
      };
    }

    // Replay missing events from projection version to latest
    const missingEvents = eventLog.filter(e => e.version > currentVersion);
    let healedData = currentView ? { ...currentView.data } : {};

    for (const evt of missingEvents) {
      healedData = projectionReducer(healedData, evt);
    }

    const healedView: MaterializedView = {
      aggregateId,
      version: latestEvent.version,
      data: healedData
    };

    return {
      updatedView: healedView,
      report: {
        aggregateId,
        inSync: false,
        eventStoreVersion: latestEvent.version,
        projectionVersion: currentVersion,
        diverged: true,
        replayedEventsCount: missingEvents.length
      }
    };
  }
}
