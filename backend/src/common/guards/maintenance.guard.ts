import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface MaintenanceConfig {
  active: boolean;
  message: string;
  estimatedDurationMinutes: number;
  whitelistedIps: string[];
}

@Injectable()
export class MaintenanceGuard implements CanActivate {
  // In-memory state mirroring Redis key `system:maintenance_mode`
  public static config: MaintenanceConfig = {
    active: false,
    message: 'CodePulse is undergoing scheduled database maintenance and infrastructure upgrades.',
    estimatedDurationMinutes: 15,
    whitelistedIps: ['127.0.0.1', '::1'],
  };

  canActivate(context: ExecutionContext): boolean {
    if (!MaintenanceGuard.config.active) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const ip = req.ip || req.socket.remoteAddress || '';
    const userRole = (req as any).user?.role;

    // Allow Admin users and whitelisted deployment IPs
    if (userRole === 'ADMIN' || MaintenanceGuard.config.whitelistedIps.includes(ip)) {
      return true;
    }

    res.setHeader('Retry-After', MaintenanceGuard.config.estimatedDurationMinutes * 60);

    throw new HttpException(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message: MaintenanceGuard.config.message,
        estimatedDurationMinutes: MaintenanceGuard.config.estimatedDurationMinutes,
        retryAfterSeconds: MaintenanceGuard.config.estimatedDurationMinutes * 60,
      },
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }
}
