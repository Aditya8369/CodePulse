import { Injectable } from '@nestjs/common';

@Injectable()
export class CswshOriginValidatorService {
  private readonly allowedOrigins = new Set([
    'https://codepulse.io',
    'https://app.codepulse.io',
    'http://localhost:3000'
  ]);

  public validateOrigin(originHeader?: string): boolean {
    if (!originHeader) return false;
    return this.allowedOrigins.has(originHeader.toLowerCase());
  }
}
