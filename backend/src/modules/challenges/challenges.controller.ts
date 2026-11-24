import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Optional,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChallengesService } from './challenges.service';
import { DifficultyCalibratorService } from './difficulty-calibrator.service';
import {
  CreateChallengeDto,
  RecordChallengeSubmissionDto,
  AuthorProblemSubmissionDto,
  FuzzPreviewDto,
  AwardAuthorRoyaltyDto,
} from './dto/challenges.dto';
import { TestGeneratorService } from '../ai/test-generator.service';
import { ProblemAuthoringService } from './problem-authoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('challenges')
@Controller('challenges')
export class ChallengesController {
  constructor(
    private readonly challengesService: ChallengesService,
    private readonly difficultyCalibratorService: DifficultyCalibratorService,
    private readonly testGeneratorService: TestGeneratorService,
    @Optional() private readonly problemAuthoringService?: ProblemAuthoringService,
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

  @Post('author/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Submit community battle challenge for 1,000-case property-based fuzzing and auto-publishing',
  })
  async submitAuthoredProblem(
    @Request() req: any,
    @Body() dto: AuthorProblemSubmissionDto,
  ) {
    if (!this.problemAuthoringService) {
      throw new Error('ProblemAuthoringService is not available');
    }
    const authorId = req.user?.id || dto.authorId;
    return this.problemAuthoringService.submitProblem({
      ...dto,
      authorId,
    });
  }

  @Post('author/fuzz-preview')
  @ApiOperation({
    summary:
      'Live property-based fuzz preview for Problem Authoring IDE (without publishing)',
  })
  async previewProblemFuzzing(@Body() dto: FuzzPreviewDto) {
    if (!this.problemAuthoringService) {
      throw new Error('ProblemAuthoringService is not available');
    }
    return this.problemAuthoringService.fuzzPreview(
      dto.referenceSolution,
      dto.validationSchema,
      dto.testGeneratorScript,
      dto.count,
    );
  }

  @Get('author/problems')
  @ApiOperation({ summary: 'List all community authored problems' })
  async listAuthoredProblems(@Query('authorId') authorId?: string) {
    if (!this.problemAuthoringService) {
      throw new Error('ProblemAuthoringService is not available');
    }
    return this.problemAuthoringService.listAuthoredProblems(authorId);
  }

  @Get('author/problems/:problemId')
  @ApiOperation({ summary: 'Get details, fuzz report, and quality score of an authored problem' })
  async getAuthoredProblem(@Param('problemId') problemId: string) {
    if (!this.problemAuthoringService) {
      throw new Error('ProblemAuthoringService is not available');
    }
    const problem = this.problemAuthoringService.getAuthoredProblem(problemId);
    if (!problem) {
      throw new Error(`Authored problem '${problemId}' not found`);
    }
    return problem;
  }

  @Post('author/problems/:problemId/royalty')
  @ApiOperation({ summary: 'Award author XP royalty when their problem is used in official battle' })
  async awardAuthorRoyalty(
    @Param('problemId') problemId: string,
    @Body() dto: AwardAuthorRoyaltyDto,
  ) {
    if (!this.problemAuthoringService) {
      throw new Error('ProblemAuthoringService is not available');
    }
    return this.problemAuthoringService.awardAuthorRoyalty(
      problemId,
      dto.battleId,
      dto.royaltyAmount,
    );
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

  @Post(':id/synthesize-tests')
  @ApiOperation({
    summary: 'Synthesize boundary condition Vitest suite for a coding challenge',
  })
  async synthesizeChallengeTests(
    @Param('id') challengeId: string,
    @Body() body: { sourceCode: string },
  ) {
    return this.testGeneratorService.synthesizeAndVerifyTestSuite({
      challengeId,
      sourceCode: body?.sourceCode ?? 'export function solve(nums: number[]): number { return nums.length; }',
    });
  }
}
