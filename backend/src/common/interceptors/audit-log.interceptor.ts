import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_ACTION_KEY, AuditActionOptions } from '../decorators/audit-action.decorator';
import { AuditLogService } from '../../modules/admin/audit-log.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly auditLogService?: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const options = this.reflector.getAllAndOverride<AuditActionOptions>(
      AUDIT_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If endpoint is not annotated with @AuditAction, pass through
    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const actorId = user?.id || user?.sub;
    const actorEmail = user?.email || user?.authEmail || user?.username;

    const ipAddress = this.extractClientIp(request);
    const userAgent = request.headers?.['user-agent'] || 'Unknown';

    // Extract targetId from params or request body
    const paramKey = options.targetIdParam || 'id';
    const targetId =
      request.params?.[paramKey] ||
      request.params?.id ||
      request.params?.userId ||
      request.body?.[paramKey] ||
      request.body?.id ||
      request.body?.userId;

    // Capture initial parameters or request payload
    const initialPayload = options.captureBody !== false ? { ...request.body } : {};

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          if (!this.auditLogService) return;
          // Asynchronously record structured audit log entry without delaying client response
          this.auditLogService
            .logAction({
              actorId,
              actorEmail,
              action: options.action,
              targetId: targetId ? targetId.toString() : undefined,
              targetType: options.targetType || 'SYSTEM',
              ipAddress,
              userAgent,
              metadata: {
                description: options.description,
                params: request.params,
                query: request.query,
                requestPayload: initialPayload,
                outcome: 'SUCCESS',
                responseSummary:
                  responseBody && typeof responseBody === 'object'
                    ? {
                        success: responseBody.success,
                        id: responseBody.id,
                        status: responseBody.status,
                        message: responseBody.message,
                      }
                    : responseBody,
              },
            })
            .catch((err) => {
              this.logger.error(
                `Failed to asynchronously persist audit log for ${options.action}: ${err?.message}`,
              );
            });
        },
        error: (error) => {
          if (!this.auditLogService) return;
          // Log failed critical administrative attempts for forensic auditing
          this.auditLogService
            .logAction({
              actorId,
              actorEmail,
              action: `${options.action}_FAILED`,
              targetId: targetId ? targetId.toString() : undefined,
              targetType: options.targetType || 'SYSTEM',
              ipAddress,
              userAgent,
              metadata: {
                description: options.description,
                params: request.params,
                query: request.query,
                outcome: 'FAILURE',
                errorMessage: error?.message,
                statusCode: error?.status || 500,
              },
            })
            .catch((err) => {
              this.logger.error(
                `Failed to persist audit log on action failure for ${options.action}: ${err?.message}`,
              );
            });
        },
      }),
    );
  }

  private extractClientIp(req: any): string {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
      }
      if (Array.isArray(forwarded) && forwarded.length > 0) {
        return forwarded[0].trim();
      }
    }
    return req.ips?.length ? req.ips[0] : req.ip || req.connection?.remoteAddress || '127.0.0.1';
  }
}
