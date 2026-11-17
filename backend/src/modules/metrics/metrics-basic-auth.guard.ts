import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Request, Response } from 'express';

@Injectable()
export class MetricsBasicAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const user = this.config.get<string>('METRICS_BASIC_AUTH_USER');
    const password = this.config.get<string>('METRICS_BASIC_AUTH_PASSWORD');
    const authorization = request.headers.authorization;

    if (user && password && authorization?.startsWith('Basic ')) {
      const candidate = Buffer.from(authorization.slice(6).trim(), 'base64');
      const expected = createHash('sha256')
        .update(`${user}:${password}`)
        .digest();
      const received = createHash('sha256').update(candidate).digest();
      if (timingSafeEqual(received, expected)) return true;
    }

    response.setHeader('WWW-Authenticate', 'Basic realm="CodePulse Metrics"');
    throw new UnauthorizedException('Metrics credentials required');
  }
}
