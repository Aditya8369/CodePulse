import { Controller, Get, Query } from '@nestjs/common';
import { GithubAppService } from './github-app.service';

@Controller('github/app')
export class GithubAppController {
  constructor(private readonly githubAppService: GithubAppService) {}

  @Get('callback')
  async handleCallback(
    @Query('installation_id') installationId: string,
    @Query('setup_action') setupAction: string
  ) {
    return {
      status: 'INSTALLED',
      installationId,
      setupAction: setupAction || 'install',
      message: 'GitHub Enterprise App successfully linked to CodePulse organization.',
    };
  }

  @Get('token')
  async getToken(@Query('installation_id') installationId: string) {
    const id = parseInt(installationId, 10) || 12345;
    const token = await this.githubAppService.getInstallationAccessToken(id);
    return {
      installationId: id,
      token,
      expiresIn: 3600,
    };
  }
}
