import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Optional,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PowService } from '../../modules/security/pow.service';

export const SKIP_POW_KEY = 'skipPowChallenge';
export const SkipPow = () => SetMetadata(SKIP_POW_KEY, true);

export const POW_CHALLENGE_HEADER = 'x-pow-challenge';
export const POW_NONCE_HEADER = 'x-pow-nonce';

@Injectable()
export class PowChallengeGuard implements CanActivate {
  constructor(
    private readonly powService: PowService,
    @Optional() private readonly reflector?: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.POW_ENABLED === 'false') {
      return true;
    }

    if (this.reflector) {
      const skip = this.reflector.getAllAndOverride<boolean>(SKIP_POW_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (skip) {
        return true;
      }
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Record<string, any>>();
    const response = http.getResponse<Record<string, any>>();

    // Record traffic load for dynamic surge difficulty calibration
    this.powService.recordTraffic();

    const challenge = this.extractHeaderOrBody(
      request,
      POW_CHALLENGE_HEADER,
      'powChallenge',
    );
    const nonce = this.extractHeaderOrBody(
      request,
      POW_NONCE_HEADER,
      'powNonce',
    );

    if (!challenge || !nonce) {
      const pow = this.powService.generateChallenge();
      this.attachPowHeaders(response, pow);

      throw new HttpException(
        {
          statusCode: HttpStatus.PRECONDITION_REQUIRED,
          error: 'Proof of Work Required',
          message:
            'Missing Proof-of-Work challenge headers (x-pow-challenge, x-pow-nonce). Solve the issued puzzle and retry.',
          pow,
        },
        HttpStatus.PRECONDITION_REQUIRED,
      );
    }

    const verification = await this.powService.verifySolution(challenge, nonce);

    if (!verification.valid) {
      const pow = this.powService.generateChallenge();
      this.attachPowHeaders(response, pow);

      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Invalid Proof of Work',
        message: verification.reason || 'Proof-of-Work solution rejected',
        pow,
      });
    }

    request.powVerification = verification;
    return true;
  }

  private extractHeaderOrBody(
    request: Record<string, any>,
    headerName: string,
    bodyField: string,
  ): string | undefined {
    const rawHeader = request?.headers?.[headerName];
    if (typeof rawHeader === 'string' && rawHeader.trim().length > 0) {
      return rawHeader.trim();
    }
    if (Array.isArray(rawHeader) && typeof rawHeader[0] === 'string') {
      return rawHeader[0].trim();
    }

    const rawBodyVal = request?.body?.[bodyField];
    if (typeof rawBodyVal === 'string' && rawBodyVal.trim().length > 0) {
      return rawBodyVal.trim();
    }
    if (typeof rawBodyVal === 'number' && Number.isFinite(rawBodyVal)) {
      return String(rawBodyVal);
    }

    return undefined;
  }

  private attachPowHeaders(
    response: Record<string, any> | undefined,
    pow: { challenge: string; difficulty: number; expiresAt: number },
  ): void {
    if (response && typeof response.setHeader === 'function') {
      response.setHeader('X-PoW-Challenge', pow.challenge);
      response.setHeader('X-PoW-Difficulty', String(pow.difficulty));
      response.setHeader('X-PoW-Expires-At', String(pow.expiresAt));
    }
  }
}
