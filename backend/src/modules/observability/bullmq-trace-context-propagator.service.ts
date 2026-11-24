import { Injectable, Logger } from '@nestjs/common';

export interface JobWithTraceContext {
  id: string;
  data: Record<string, unknown>;
  traceContext: { traceId: string; spanId: string };
}

@Injectable()
export class BullmqTraceContextPropagatorService {
  private readonly logger = new Logger(BullmqTraceContextPropagatorService.name);

  public attachTraceContext(jobData: Record<string, unknown>, traceId: string, spanId: string): JobWithTraceContext {
    return {
      id: `job-${Date.now()}`,
      data: jobData,
      traceContext: { traceId, spanId },
    };
  }
}
