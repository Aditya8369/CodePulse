import { Controller, Post, Get, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GuildsService } from './guilds.service';
import { CreateGuildDto, UpdateMemberRoleDto } from './dto/guilds.dto';

@ApiTags('guilds')
@Controller('guilds')
export class GuildsController {
  constructor(private readonly guildsService: GuildsService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new developer guild' })
  async createGuild(@Req() req: any, @Body() dto: CreateGuildDto) {
    const userId = req.user?.id || 'mock-user-id';
    return this.guildsService.createGuild(userId, dto);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get guild profile and members roster by slug' })
  async getGuildBySlug(@Param('slug') slug: string) {
    return this.guildsService.getGuildBySlug(slug);
  }

  @Post(':id/join')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join a public guild or use invite code' })
  async joinGuild(@Param('id') id: string, @Req() req: any, @Body() body: { inviteCode?: string }) {
    const userId = req.user?.id || 'mock-user-id';
    return this.guildsService.joinGuild(id, userId, body?.inviteCode);
  }

  @Patch(':id/members/:userId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Promote or demote guild member' })
  async updateMemberRole(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Req() req: any,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    const actorId = req.user?.id || 'mock-user-id';
    return this.guildsService.updateMemberRole(id, actorId, targetUserId, dto);
  }

  @Delete(':id/members/:userId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kick or remove a member from guild' })
  async kickMember(@Param('id') id: string, @Param('userId') targetUserId: string, @Req() req: any) {
    const actorId = req.user?.id || 'mock-user-id';
    return this.guildsService.kickMember(id, actorId, targetUserId);
  }
}
