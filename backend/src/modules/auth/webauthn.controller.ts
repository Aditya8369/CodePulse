import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  WebAuthnService,
  VerifyRegistrationDto,
  VerifyAuthenticationDto,
} from './webauthn.service';

@Controller('auth/webauthn')
export class WebAuthnController {
  constructor(private readonly webAuthnService: WebAuthnService) {}

  @Post('register/options')
  @HttpCode(HttpStatus.OK)
  generateRegistrationOptions(
    @Body() body: { userId: string; username: string },
  ) {
    return this.webAuthnService.generateRegistrationOptions(
      body.userId,
      body.username,
    );
  }

  @Post('register/verify')
  @HttpCode(HttpStatus.CREATED)
  verifyRegistrationResponse(@Body() dto: VerifyRegistrationDto) {
    return this.webAuthnService.verifyRegistrationResponse(dto);
  }

  @Post('login/options')
  @HttpCode(HttpStatus.OK)
  generateAuthenticationOptions(@Body() body: { userId: string }) {
    return this.webAuthnService.generateAuthenticationOptions(body.userId);
  }

  @Post('login/verify')
  @HttpCode(HttpStatus.OK)
  verifyAuthenticationResponse(@Body() dto: VerifyAuthenticationDto) {
    return this.webAuthnService.verifyAuthenticationResponse(dto);
  }

  @Get('passkeys')
  listUserPasskeys(@Query('userId') userId: string) {
    return this.webAuthnService.listUserPasskeys(userId);
  }

  @Delete('passkeys/:credentialId')
  deletePasskey(
    @Query('userId') userId: string,
    @Param('credentialId') credentialId: string,
  ) {
    const success = this.webAuthnService.deletePasskey(userId, credentialId);
    return { success };
  }
}
