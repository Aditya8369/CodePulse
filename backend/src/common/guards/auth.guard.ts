import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { SessionMeshService } from '../../modules/auth/session-mesh.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Optional() private readonly sessionMesh?: SessionMeshService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!request) return true;

    const authHeader = request.headers?.authorization;
    const sessionId = request.headers?.['x-session-id'] as string | undefined;
    const userId = (request.user?.id || request.headers?.['x-user-id']) as string | undefined;

    // Check with zero-latency in-memory session mesh
    if (this.sessionMesh && (sessionId || userId)) {
      const isRevoked = this.sessionMesh.isSessionRevoked(sessionId, userId);
      if (isRevoked) {
        throw new UnauthorizedException('Session has been revoked by security policy.');
      }
    }

    // If Authorization header present and not revoked, proceed
    if (authHeader && !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid authorization scheme.');
    }

    return true;
  }
}
