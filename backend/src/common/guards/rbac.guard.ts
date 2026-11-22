import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OpaService } from '../../modules/sec/opa.service';

export const OPA_ACTION_KEY = 'opa_action';
export const OPA_RESOURCE_TYPE_KEY = 'opa_resource_type';

export const OpaPolicyCheck = (action: string, resourceType: string) => {
  return (target: object, key?: any, descriptor?: any) => {
    SetMetadata(OPA_ACTION_KEY, action)(target, key, descriptor);
    SetMetadata(OPA_RESOURCE_TYPE_KEY, resourceType)(target, key, descriptor);
  };
};

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly opaService: OpaService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const action = this.reflector.getAllAndOverride<string>(OPA_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const resourceType = this.reflector.getAllAndOverride<string>(OPA_RESOURCE_TYPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no OPA metadata is specified, proceed
    if (!action || !resourceType) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) {
      throw new ForbiddenException('Authentication required for authorized operation');
    }

    const subject = {
      id: user.id || user.userId || 'anonymous',
      role: user.role || 'PLAYER',
      roles: user.roles || [user.role || 'PLAYER'],
      clanId: user.clanId,
      trustScore: user.trustScore,
    };

    const resource = {
      type: resourceType,
      id: req.params?.id || req.body?.resourceId,
      ownerId: req.params?.userId || req.body?.ownerId,
    };

    const result = this.opaService.evaluate({
      subject,
      action,
      resource,
    });

    if (!result.allowed) {
      throw new ForbiddenException(
        `Access denied: ${result.reason} [Audit Decision ID: ${result.decisionId}]`,
      );
    }

    return true;
  }
}
