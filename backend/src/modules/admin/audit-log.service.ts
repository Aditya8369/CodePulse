import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAuditLogDto, AuditLogQueryDto } from './dto/audit-log.dto';

export interface AuditLogEntry {
  id: string;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetId?: string | null;
  targetType?: string | null;
  targetResource?: string | null;
  metadata?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}

export interface PaginatedAuditLogs {
  data: any[];
  items: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  // Sensitive field names to automatically mask from audit metadata
  private readonly SENSITIVE_KEYS = new Set([
    'password',
    'passwordhash',
    'token',
    'refreshtoken',
    'accesstoken',
    'secret',
    'twofactorsecret',
    'authorization',
    'cookie',
    'apikey',
    'privatekey',
  ]);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Appends an immutable audit log entry.
   * Supports both object-based DTO and legacy positional arguments.
   */
  async logAction(
    dtoOrActorId: CreateAuditLogDto | string,
    action?: string,
    targetResource?: string,
    targetId?: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
  ): Promise<any> {
    let dto: CreateAuditLogDto;

    if (typeof dtoOrActorId === 'object' && dtoOrActorId !== null) {
      dto = dtoOrActorId;
    } else {
      dto = {
        actorId: dtoOrActorId,
        action: action || 'UNKNOWN_ACTION',
        targetType: targetResource || 'SYSTEM',
        targetId,
        metadata,
        ipAddress,
      };
    }

    const sanitizedMetadata = dto.metadata
      ? this.maskSensitiveFields(dto.metadata)
      : undefined;

    const record = await this.prisma.auditLog.create({
      data: {
        actorId: dto.actorId,
        actorEmail: dto.actorEmail,
        action: dto.action.toUpperCase().trim(),
        targetId: dto.targetId,
        targetType: (dto.targetType || targetResource || 'SYSTEM').toUpperCase().trim(),
        metadata: sanitizedMetadata,
        ipAddress: dto.ipAddress || '127.0.0.1',
        userAgent: dto.userAgent,
      },
    });

    this.logger.log(
      `[AUDIT] Action: ${record.action} | Actor: ${record.actorEmail || record.actorId || 'SYSTEM'} | Target: ${record.targetType}:${record.targetId || 'N/A'} | IP: ${record.ipAddress}`,
    );

    return {
      ...record,
      targetResource: record.targetType,
    };
  }

  /**
   * Retrieves paginated audit logs with multi-dimensional filtering.
   * Supports both DTO-based query and legacy (page, limit) arguments.
   */
  async getAuditLogs(
    queryOrPage: AuditLogQueryDto | number = 1,
    legacyLimit = 20,
  ): Promise<PaginatedAuditLogs> {
    let query: AuditLogQueryDto;
    if (typeof queryOrPage === 'number') {
      query = { page: queryOrPage, limit: legacyLimit };
    } else {
      query = queryOrPage || {};
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.action) {
      where.action = query.action.toUpperCase().trim();
    }

    if (query.actorId) {
      where.actorId = query.actorId;
    }

    if (query.targetId) {
      where.targetId = query.targetId;
    }

    if (query.targetType) {
      where.targetType = query.targetType.toUpperCase().trim();
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const mappedData = data.map((item) => ({
      ...item,
      targetResource: item.targetType,
    }));

    return {
      data: mappedData,
      items: mappedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves a single audit log entry by ID.
   */
  async getAuditLogById(id: string): Promise<any> {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
    });

    if (!log) {
      throw new NotFoundException(`Audit log entry with ID ${id} not found.`);
    }

    return {
      ...log,
      targetResource: log.targetType,
    };
  }

  /**
   * Append-only enforcement: Rejects any attempt to update an audit log record.
   */
  async updateAuditLog(): Promise<never> {
    throw new ForbiddenException(
      'Audit logs are append-only and strictly immutable. UPDATE operations are forbidden by security policy and database triggers.',
    );
  }

  /**
   * Append-only enforcement: Rejects any attempt to delete an audit log record.
   */
  async deleteAuditLog(): Promise<never> {
    throw new ForbiddenException(
      'Audit logs are append-only and strictly immutable. DELETE operations are forbidden by security policy and database triggers.',
    );
  }

  /**
   * Recursively masks sensitive fields such as passwords and secret tokens.
   */
  private maskSensitiveFields(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.maskSensitiveFields(item));
    }

    const masked: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lower = key.toLowerCase();
      if (
        this.SENSITIVE_KEYS.has(lower) ||
        lower.includes('password') ||
        lower.includes('secret')
      ) {
        masked[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskSensitiveFields(value);
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }
}
