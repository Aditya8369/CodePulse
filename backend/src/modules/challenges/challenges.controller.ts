import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChallengesService } from './challenges.service';
import { DifficultyCalibratorService } from './difficulty-calibrator.service';
import { CreateChallengeDto, RecordChallengeSubmissionDto } from './dto/challenges.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('challenges')
@Controller('challenges')
export class ChallengesController {
  constructor(
    private readonly challengesService: ChallengesService,
    private readonly difficultyCalibratorService: DifficultyCalibratorService,
  ) {}

  @Get('active')
  @ApiOperation({ summary: 'Get all active challenges' })
  async getActiveChallenges() {
    return this.challengesService.getActiveChallenges();
  }

  @Get('user/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get challenges for current authenticated user' })
  async getMyChallenges(@Request() req: any) {
    return this.challengesService.getUserChallenges(req.user.id);
  }

  @Get(':id/difficulty')
  @ApiOperation({ summary: 'Get Glicko-2 dynamic difficulty rating and pass-rate metrics for a challenge' })
  async getChallengeDifficulty(@Param('id') challengeId: string) {
    return this.difficultyCalibratorService.getDifficultyMetrics(challengeId);
  }

  @Post(':id/submission')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record a challenge attempt and dynamically calibrate Glicko-2 difficulty' })
  async recordChallengeSubmission(
    @Request() req: any,
    @Param('id') challengeId: string,
    @Body() dto: RecordChallengeSubmissionDto,
  ) {
    return this.difficultyCalibratorService.recordSubmissionAndCalibrate({
      challengeId,
      userId: req.user?.id || dto.userId,
      passed: dto.passed,
      playerRating: dto.playerRating,
      playerRd: dto.playerRd,
      partialScore: dto.partialScore,
      battleId: dto.battleId,
    });
  }

  @Post('calibrate')
  @ApiOperation({ summary: 'Trigger batch/nightly Glicko-2 difficulty calibration across all challenges (Admin/Dev)' })
  async triggerDifficultyCalibration() {
    return this.difficultyCalibratorService.runNightlyCalibration();
  }

  @Post(':id/claim')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Claim XP reward for a completed challenge' })
  async claimChallenge(@Request() req: any, @Param('id') challengeId: string) {
    return this.challengesService.claimChallengeReward(
      req.user.id,
      challengeId,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new challenge (Admin)' })
  async createChallenge(@Body() dto: CreateChallengeDto) {
    return this.challengesService.createChallenge(dto);
  }

  @Post('trigger')
  @ApiOperation({ summary: 'Trigger generation of daily challenges (Admin/Dev)' })
  async triggerDailyChallenges() {
    await this.challengesService.generateDailyChallenges();
    return { success: true, message: 'Daily challenges generated' };
  }
}
