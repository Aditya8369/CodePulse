import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PowService } from './pow.service';
import type {
  PowChallengeResponse,
  PowTrafficMetrics,
} from './pow.service';

@ApiTags('security')
@Controller('security/pow')
export class PowController {
  constructor(private readonly powService: PowService) {}

  @Get('challenge')
  @ApiOperation({
    summary: 'Request a dynamic cryptographic Proof-of-Work challenge',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns a signed SHA-256 PoW challenge calibrated to current traffic load',
  })
  getChallenge(): PowChallengeResponse {
    return this.powService.generateChallenge();
  }

  @Get('status')
  @ApiOperation({
    summary: 'Inspect current PoW difficulty calibration and traffic surge telemetry',
  })
  getStatus(): PowTrafficMetrics {
    return this.powService.getTrafficMetrics();
  }
}
