import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BattlesService } from './battles.service';
import { CreateBattleDto, UpdateBattleStatusDto } from './dto/battles.dto';

@ApiTags('battles')
@Controller('battles')
export class BattlesController {
  constructor(private readonly battlesService: BattlesService) {}

  @Get('active')
  @ApiOperation({ summary: 'Get all active global battles' })
  async getActiveBattles() {
    return this.battlesService.getActiveBattles();
  }

  @Get('head-to-head')
  @ApiOperation({
    summary: 'Get completed head-to-head battles for two GitHub usernames',
  })
  async getHeadToHead(
    @Query('user1') user1?: string,
    @Query('user2') user2?: string,
  ) {
    const validUsername = (value?: string) =>
      !!value && /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(value);
    if (
      !validUsername(user1) ||
      !validUsername(user2) ||
      user1!.toLowerCase() === user2!.toLowerCase()
    ) {
      throw new BadRequestException(
        'Two distinct GitHub usernames are required',
      );
    }
    return this.battlesService.getHeadToHead(user1!, user2!);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get battles for a specific user' })
  async getUserBattles(@Param('userId') userId: string) {
    return this.battlesService.getUserBattles(userId);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Challenge a user to a battle' })
  async createBattle(@Body() dto: CreateBattleDto) {
    return this.battlesService.createBattle(dto);
  }

  @Put(':id/status')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Update battle status (e.g., mark as completed and declare winner)',
  })
  async updateBattleStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBattleStatusDto,
  ) {
    return this.battlesService.updateBattleStatus(id, dto);
  }
}
