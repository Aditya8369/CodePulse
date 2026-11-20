import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: string;
  targetResource: string;
  targetId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logAction(
    actorId: string,
    action: string,
    targetResource: string,
    targetId?: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
  ): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      actorId,
      action,
      targetResource,
      targetId,
      metadata,
      ipAddress,
      createdAt: new Date(),
    };

    this.logger.log(`[AUDIT] Actor: ${actorId} | Action: ${action} | Resource: ${targetResource}/${targetId || 'all'} | IP: ${ipAddress || 'unknown'}`);
    return entry;
  }

  async getAuditLogs(page = 1, limit = 20) {
    return {
      page,
      limit,
      total: 3,
      items: [
        {
          id: "audit-1",
          actorId: "admin-1",
          action: "UPDATE_USER_XP",
          targetResource: "developer_ratings",
          targetId: "user-44",
          metadata: { oldXp: 1200, newXp: 1450, reason: "Tournament adjustment" },
          ipAddress: "192.168.1.1",
          createdAt: new Date().toISOString(),
        },
        {
          id: "audit-2",
          actorId: "admin-1",
          action: "TOGGLE_MAINTENANCE_MODE",
          targetResource: "system",
          metadata: { enabled: false },
          ipAddress: "192.168.1.1",
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: "audit-3",
          actorId: "mod-2",
          action: "DELETE_SUSPICIOUS_BATTLE",
          targetResource: "battles",
          targetId: "battle-99",
          metadata: { reason: "Win-trading bot detected" },
          ipAddress: "10.0.0.4",
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
    };
  }
}
