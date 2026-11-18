import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { DisputeService } from './dispute.service';
import type { DisputeStatus, DisputeVerdict } from './dispute.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class CreateDisputePayload {
  battleId: string;
  reason: string;
  accusedId?: string;
  evidenceUrl?: string;
  testCasesStdout?: string;
  testCasesStderr?: string;
  networkRttTelemetry?: any;
  tabFocusLogs?: any;
  finalCodeState?: string;
}

class ResolveDisputePayload {
  verdict: DisputeVerdict;
  adminNotes?: string;
}

@ApiTags('disputes')
@Controller('disputes')
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'File a new match dispute and capture automated forensic snapshot (keystrokes, test case outputs, network RTT, and tab focus)',
  })
  @ApiBody({ type: CreateDisputePayload })
  async createDispute(@Request() req: any, @Body() body: CreateDisputePayload) {
    const filerId = req.user?.id || req.user?.sub || 'anonymous';
    return this.disputeService.fileDispute({
      ...body,
      filerId,
    });
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all match disputes for admin review' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'] })
  async getDisputes(@Query('status') status?: DisputeStatus) {
    return this.disputeService.getDisputes(status);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get match dispute details by ID' })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  async getDisputeById(@Param('id') id: string) {
    return this.disputeService.getDisputeById(id);
  }

  @Get(':id/time-travel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Time-Travel Gateway: Frame-by-frame match state scrubbing through keystrokes, stdout/stderr, and network telemetry',
  })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  async getTimeTravelSnapshot(@Param('id') id: string) {
    return this.disputeService.getTimeTravelSnapshot(id);
  }

  @Patch('admin/:id/resolve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Adjudicate and resolve a match dispute (Nullify match, award win to victim, ban cheater, or dismiss with penalty)',
  })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  @ApiBody({ type: ResolveDisputePayload })
  async resolveDispute(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: ResolveDisputePayload,
  ) {
    const adminId = req.user?.id || req.user?.sub || 'admin';
    return this.disputeService.resolveDispute({
      disputeId: id,
      adminId,
      verdict: body.verdict,
      adminNotes: body.adminNotes,
    });
  }
}

