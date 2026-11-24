import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GrpcOtelCorrelationInterceptorService {
  private readonly logger = new Logger(GrpcOtelCorrelationInterceptorService.name);

  public injectCorrelationMetadata(metadata: Map<string, string>, traceId: string): Map<string, string> {
    metadata.set('x-correlation-id', traceId);
    metadata.set('traceparent', `00-${traceId}-0000000000000001-01`);
    return metadata;
  }
}
