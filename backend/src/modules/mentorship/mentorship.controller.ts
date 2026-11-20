import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ShadowCodingService } from './shadow-coding.service';
import {
  CreateShadowSessionDto,
  HandoverDriverSeatDto,
  MatchPairingDto,
  UpdateMentorshipProfileDto,
  ViewportSyncDto,
} from './dto/mentorship.dto';

@ApiTags('mentorship')
@Controller('mentorship')
export class MentorshipController {
  constructor(private readonly shadowService: ShadowCodingService) {}

  @Get('profiles/:userId')
  @ApiOperation({ summary: 'Get mentorship profile skills, target goals, and verified hours' })
  async getProfile(@Param('userId') userId: string) {
    return this.shadowService.getProfile(userId);
  }

  @Patch('profiles/:userId')
  @ApiOperation({ summary: 'Update mentorship profile attributes' })
  async updateProfile(
    @Param('userId') userId: string,
    @Body() dto: UpdateMentorshipProfileDto,
  ) {
    return this.shadowService.updateProfile(userId, dto);
  }

  @Get('pairings')
  @ApiOperation({ summary: 'Find compatible mentors based on skills, timezone, and ranking' })
  async findMentors(@Query() query: MatchPairingDto) {
    return this.shadowService.findCompatibleMentors(query);
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Create and start a real-time shadow coding session' })
  async createSession(
    @Query('apprenticeId') apprenticeId: string,
    @Body() dto: CreateShadowSessionDto,
  ) {
    return this.shadowService.createSession(apprenticeId || 'anonymous_dev', dto);
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Get shadow session details and live viewport state' })
  async getSession(@Param('sessionId') sessionId: string) {
    return this.shadowService.getSession(sessionId);
  }

  @Patch('sessions/:sessionId/driver-seat')
  @ApiOperation({ summary: 'One-click handover of the driver seat between Mentor and Apprentice' })
  async handoverDriverSeat(
    @Param('sessionId') sessionId: string,
    @Query('userId') userId: string,
    @Body() dto: HandoverDriverSeatDto,
  ) {
    return this.shadowService.handoverDriverSeat(sessionId, userId || 'session_user', dto);
  }

  @Post('sessions/:sessionId/sync-viewport')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Synchronize live viewport, cursor line/col, active file, and notes (< 20ms lag)' })
  async syncViewport(
    @Param('sessionId') sessionId: string,
    @Query('senderId') senderId: string,
    @Body() dto: ViewportSyncDto,
  ) {
    return this.shadowService.syncViewport(sessionId, senderId || 'sender', dto);
  }

  @Post('sessions/:sessionId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete session and log verified mentorship hours towards Certified Mentor badge' })
  async completeSession(
    @Param('sessionId') sessionId: string,
    @Query('userId') userId: string,
    @Query('durationMinutes') durationMinutes?: number,
  ) {
    return this.shadowService.completeSession(
      sessionId,
      userId || 'session_user',
      durationMinutes ? Number(durationMinutes) : 60,
    );
  }
}
