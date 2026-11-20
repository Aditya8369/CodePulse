import { Controller, Sse, MessageEvent } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { CdcService } from './cdc.service';

@Controller('realtime')
export class PulseController {
  constructor(private readonly cdcService: CdcService) {}

  @Sse('pulse')
  streamActivity(): Observable<MessageEvent> {
    return this.cdcService.getActivityStream().pipe(
      map(event => ({
        data: event,
      }))
    );
  }
}
