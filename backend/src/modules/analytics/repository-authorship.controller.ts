import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusFactorService } from './bus-factor.service';

@ApiTags('repositories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('repositories')
export class RepositoryAuthorshipController {
  constructor(private readonly busFactor: BusFactorService) {}

  @Get(':id/bus-factor')
  @ApiOperation({
    summary:
      'Estimate contributor knowledge concentration from bounded public GitHub history',
  })
  getBusFactor(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.busFactor.getReport(req.user.id, id);
  }
}
