import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { BinaryWalService } from './binary-wal.service';
import { WalMetrics, WalRecoveryReport } from './binary-wal.types';

@Controller('storage/wal')
export class BinaryWalController {
  constructor(private readonly walService: BinaryWalService) {}

  @Get('metrics')
  public getMetrics(): WalMetrics {
    return this.walService.getMetrics();
  }

  @Post('flush')
  @HttpCode(HttpStatus.OK)
  public flush(): { flushed: boolean; currentLsn: string } {
    this.walService.flushBuffer(true);
    return {
      flushed: true,
      currentLsn: this.walService.getCurrentLsn().toString(),
    };
  }

  @Post('recover')
  @HttpCode(HttpStatus.OK)
  public recover(): WalRecoveryReport {
    return this.walService.recover();
  }
}
