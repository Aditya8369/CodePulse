import { SetMetadata, CustomDecorator } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'audit_action_metadata';

export interface AuditActionOptions {
  action: string;
  targetType?: 'USER' | 'SYSTEM' | 'ORGANIZATION' | 'SETTING' | 'BATTLE' | string;
  targetIdParam?: string;
  description?: string;
  captureBody?: boolean;
}

/**
 * Decorator to attach audit action metadata to controller route handlers.
 * Intercepted by AuditLogInterceptor to produce immutable audit trail entries.
 *
 * @example
 * @AuditAction('USER_DELETED', { targetType: 'USER', targetIdParam: 'id' })
 * @AuditAction('MAINTENANCE_TOGGLED', { targetType: 'SYSTEM' })
 */
export const AuditAction = (
  action: string,
  options?: Omit<AuditActionOptions, 'action'>,
): CustomDecorator<string> =>
  SetMetadata(AUDIT_ACTION_KEY, {
    action,
    targetType: options?.targetType || 'SYSTEM',
    targetIdParam: options?.targetIdParam || 'id',
    description: options?.description,
    captureBody: options?.captureBody ?? true,
  });
