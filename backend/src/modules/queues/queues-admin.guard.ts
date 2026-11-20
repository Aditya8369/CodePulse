import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class QueuesAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext) {
    const userId = context
      .switchToHttp()
      .getRequest<{ user?: { id?: string } }>().user?.id;
    const allowed = (this.config.get<string>('QUEUE_ADMIN_USER_IDS') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (!userId || !allowed.includes(userId))
      throw new ForbiddenException('Queue administrator access required');
    return true;
  }
}
