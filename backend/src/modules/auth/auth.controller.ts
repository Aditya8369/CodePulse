import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import {
  AuthResponseDto,
  EmailPasswordDto,
  ForgotPasswordDto,
  GitHubLoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('github')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate using GitHub OAuth code' })
  @ApiResponse({
    status: 200,
    description: 'Successful authentication',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired GitHub code' })
  async githubLogin(
    @Body() loginDto: GitHubLoginDto,
  ): Promise<AuthResponseDto> {
    return this.authService.authenticateWithGitHub(loginDto.code);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an account with email and password' })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  async login(@Body() loginDto: EmailPasswordDto): Promise<AuthResponseDto> {
    return this.authService.authenticateWithPassword(
      loginDto.email,
      loginDto.password,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate and refresh JWT access token using a valid refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Fresh access token and rotated refresh token issued',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid, reused, or expired refresh token' })
  async refresh(
    @Body() refreshDto: RefreshTokenDto,
  ): Promise<AuthResponseDto> {
    return this.authService.refreshAccessToken(
      refreshDto.refreshToken,
      refreshDto.deviceFingerprint,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke and blacklist refresh token family and access token' })
  @ApiResponse({
    status: 200,
    description: 'Successfully logged out and token family blacklisted',
  })
  async logout(
    @Body() logoutDto: LogoutDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const authHeader = req.headers['authorization'];
    const accessToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : undefined;
    return this.authService.logout(logoutDto.refreshToken, accessToken);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a time-limited password-reset link' })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.requestPasswordReset(forgotPasswordDto.email);
    return {
      message:
        'If an account exists for that email, a password-reset link will be sent.',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.password,
    );
    return { message: 'Your password has been updated.' };
  }
}
