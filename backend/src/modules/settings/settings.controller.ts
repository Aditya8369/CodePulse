import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user settings' })
  async getSettings(@Request() req: { user: { id: string } }) {
    return this.settingsService.getUserSettings(req.user.id);
  }

  @Put()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user settings' })
  async updateSettings(
    @Request() req: { user: { id: string } },
    @Body() settings: unknown,
  ) {
    return this.settingsService.updateUserSettings(req.user.id, settings);
  }
}
