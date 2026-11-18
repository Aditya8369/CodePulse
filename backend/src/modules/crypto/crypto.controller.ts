import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ZkpVerifierService } from './zkp-verifier.service';
import type {
  ZkpVerificationRequest,
  ZkpVerificationResult,
} from './zkp-verifier.service';

@ApiTags('crypto')
@Controller('crypto')
export class CryptoController {
  constructor(private readonly zkpService: ZkpVerifierService) {}

  @Post('verify-zkp-proof')
  @ApiOperation({
    summary:
      'Verify zk-SNARK (Groth16) Zero-Knowledge Proof for private code battles in < 5ms',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns cryptographic validity of the submitted ZKP proof',
  })
  async verifyZkpProof(
    @Body() payload: ZkpVerificationRequest,
  ): Promise<ZkpVerificationResult> {
    if (!payload) {
      throw new BadRequestException('Request body is required');
    }
    return this.zkpService.verifyZkpProof(payload);
  }

  @Get('vk/:problemId')
  @ApiOperation({
    summary: 'Get Groth16 verification key for an algorithmic problem circuit',
  })
  getVerificationKey(@Param('problemId') problemId: string) {
    const vk = this.zkpService.getVerificationKey(problemId);
    if (!vk) {
      throw new BadRequestException(`No verification key found for ${problemId}`);
    }
    return vk;
  }
}
