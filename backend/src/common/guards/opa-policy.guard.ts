import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OpaEngineService, OpaEvaluationInput } from './opa-engine.service';
import { OPA_POLICY_KEY, OpaPolicyMetadata } from './opa-policy.decorator';

@Injectable()
export class OpaPolicyGuard implements CanActivate {
  private readonly logger = new Logger(OpaPolicyGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly opaEngine: OpaEngineService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyMeta = this.reflector.getAllAndOverride<OpaPolicyMetadata>(
      OPA_POLICY_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no OPA policy rule is specified on endpoint, permit continuation
    if (!policyMeta) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user || {
      id: 'anonymous',
      roles: ['GUEST'],
      tenantId: 'public',
    };

    // Client IP extraction (supporting reverse proxies)
    const clientIp =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.socket?.remoteAddress ||
      '127.0.0.1';

    // Tenant extraction
    const tenantId =
      policyMeta.extractTenantFromParam && request.params[policyMeta.extractTenantFromParam]
        ? request.params[policyMeta.extractTenantFromParam]
        : request.headers['x-tenant-id'] || user.tenantId || 'global';

    // Resource parameters extraction
    const resourceId =
      policyMeta.extractResourceFromParam && request.params[policyMeta.extractResourceFromParam]
        ? request.params[policyMeta.extractResourceFromParam]
        : request.params?.id;

    // Environmental / context headers
    const ipWhitelistHeader = request.headers['x-tenant-ip-whitelist'] as string;
    const ipWhitelist = ipWhitelistHeader
      ? ipWhitelistHeader.split(',').map((s) => s.trim())
      : [];

    const isMaintenance =
      request.headers['x-system-maintenance'] === 'true' ||
      process.env.OPA_SYSTEM_MAINTENANCE === 'true';

    const battleState = request.body?.battleState || request.query?.battleState;
    const participants = request.body?.participants || [];

    const evaluationInput: OpaEvaluationInput = {
      user: {
        id: user.id || 'anonymous',
        roles: Array.isArray(user.roles) ? user.roles : [user.role || 'GUEST'],
        tenantId: user.tenantId || tenantId,
        attributes: user.attributes || {},
      },
      action: policyMeta.action,
      resource: {
        type: policyMeta.resourceType,
        id: resourceId,
        tenantId,
        battleState,
        participants,
        attributes: request.body?.resourceAttributes || {},
      },
      context: {
        clientIp,
        ipWhitelist,
        timestamp: new Date().toISOString(),
        maintenanceWindow: isMaintenance,
        attributes: {
          userAgent: request.headers['user-agent'],
        },
      },
    };

    const decision = this.opaEngine.evaluate(evaluationInput);

    if (!decision.allow) {
      // Rule 5 violation security audit log
      this.logger.warn({
        event: 'SECURITY_AUTHORIZATION_DENIAL',
        user: evaluationInput.user.id,
        tenant: evaluationInput.user.tenantId,
        action: evaluationInput.action,
        resource: evaluationInput.resource.type,
        resourceId: evaluationInput.resource.id,
        clientIp: evaluationInput.context.clientIp,
        evaluationDurationMs: decision.evaluationDurationMs,
        denyReasons: decision.denyReasons,
        policyVersion: decision.policyVersion,
      });

      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied by Open Policy Agent (OPA) policy rules',
        denyReasons: decision.denyReasons,
        evaluationDurationMs: decision.evaluationDurationMs,
      });
    }

    // Attach evaluation performance result to request context
    request.opaDecision = decision;
    return true;
  }
}
