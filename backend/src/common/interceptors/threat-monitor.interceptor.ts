import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { from, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ThreatDetectorService } from '../../modules/security/threat-detector.service';
import { PowService } from '../../modules/security/pow.service';

@Injectable()
export class ThreatMonitorInterceptor implements NestInterceptor {
  constructor(
    private readonly threatDetector: ThreatDetectorService,
    @Optional() private readonly powService?: PowService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Exempt health probes and the PoW challenge bootstrap endpoint
    const rawUrl = request.originalUrl || request.url || '/';
    if (
      rawUrl.startsWith('/health') ||
      rawUrl.includes('/security/pow/challenge')
    ) {
      return next.handle();
    }

    const ip = this.extractClientIp(request);
    const userId = (request as Request & { user?: { id?: string } }).user?.id;

    return from(
      this.threatDetector.evaluateRequest({
        ip,
        userId,
        method: request.method,
        path: rawUrl,
        query: request.query as Record<string, unknown>,
        body: request.body,
        headers: request.headers,
      }),
    ).pipe(
      switchMap(async (assessment) => {
        response.setHeader(
          'X-Threat-Anomaly-Score',
          String(assessment.anomalyScore),
        );
        response.setHeader('X-Threat-Action', assessment.action);

        if (assessment.action === 'QUARANTINE') {
          throw new HttpException(
            {
              statusCode: HttpStatus.FORBIDDEN,
              error: 'IP Quarantined',
              message:
                'Request blocked: anomalous behavioral threat signature detected.',
              anomalyScore: assessment.anomalyScore,
              vector: assessment.primaryVector,
              quarantineExpiresAt: assessment.quarantineExpiresAt,
            },
            HttpStatus.FORBIDDEN,
          );
        }

        if (assessment.action === 'CHALLENGE') {
          // If client attached a valid PoW solution, allow through
          const powChallenge = this.readHeader(request, 'x-pow-challenge');
          const powNonce = this.readHeader(request, 'x-pow-nonce');
          if (powChallenge && powNonce && this.powService) {
            const verification = await this.powService.verifySolution(
              powChallenge,
              powNonce,
            );
            if (verification.valid) {
              return next.handle();
            }
          }

          throw new HttpException(
            {
              statusCode: HttpStatus.PRECONDITION_REQUIRED,
              error: 'Adaptive Security Challenge Required',
              message:
                'Elevated API anomaly score detected. Solve the Proof-of-Work challenge and retry.',
              anomalyScore: assessment.anomalyScore,
              vector: assessment.primaryVector,
              pow: assessment.powChallenge,
            },
            HttpStatus.PRECONDITION_REQUIRED,
          );
        }

        return next.handle();
      }),
      switchMap((inner$) => inner$),
    );
  }

  private extractClientIp(request: Request): string {
    const xff = request.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim().length > 0) {
      return xff.split(',')[0].trim();
    }
    return request.ip || request.socket?.remoteAddress || '0.0.0.0';
  }

  private readHeader(request: Request, name: string): string | undefined {
    const val = request.headers[name];
    if (typeof val === 'string' && val.trim().length > 0) return val.trim();
    if (Array.isArray(val) && val[0]) return val[0].trim();
    return undefined;
  }
}
