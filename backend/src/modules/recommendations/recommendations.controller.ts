import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecommendationsService } from './recommendations.service';

@ApiTags('recommendations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}
  @Get('tech-stack')
  @ApiOperation({
    summary:
      'Suggest technology progressions from current public repository evidence',
  })
  getTechStack(@Request() req: { user: { id: string } }) {
    return this.recommendations.getTechStack(req.user.id);
  }
}
