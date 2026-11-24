import { Injectable } from '@nestjs/common';

export interface MigrationPayload {
  sessionId: string;
  sourceNode: string;
  targetNode: string;
  state: Record<string, any>;
  migratedAt: number;
}

@Injectable()
export class SessionGeoMigrationService {
  private readonly migrationLog = new Map<string, MigrationPayload>();

  public migrateSession(sessionId: string, source: string, target: string, state: Record<string, any>): MigrationPayload {
    const payload: MigrationPayload = {
      sessionId,
      sourceNode: source,
      targetNode: target,
      state,
      migratedAt: Date.now(),
    };
    this.migrationLog.set(sessionId, payload);
    return payload;
  }

  public getSession(sessionId: string): MigrationPayload | undefined {
    return this.migrationLog.get(sessionId);
  }
}
