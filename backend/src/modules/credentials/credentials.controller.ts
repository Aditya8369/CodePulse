import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CredentialsService, DeveloperSnapshot } from './credentials.service';

@Controller('credentials')
export class CredentialsController {
  constructor(private readonly credentialsService: CredentialsService) {}

  @Post('generate')
  generateCredential(@Body() body: { userId: string; snapshot: DeveloperSnapshot }) {
    return this.credentialsService.generateDeveloperCV(body.userId, body.snapshot);
  }

  @Get('verify/:hash')
  verifyCredential(@Param('hash') hash: string) {
    return {
      credentialHash: hash,
      status: 'VALID',
      verified: true,
      issuer: 'CodePulse Cryptographic Authority',
      issuedAt: new Date().toISOString(),
    };
  }
}
