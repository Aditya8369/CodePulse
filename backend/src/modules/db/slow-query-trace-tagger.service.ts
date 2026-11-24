import { Injectable } from '@nestjs/common';

@Injectable()
export class SlowQueryTraceTaggerService {
  public injectTraceBaggage(sql: string, traceId: string, spanId: string, route: string): string {
    // Prepend SQL comment with OpenTelemetry / W3C baggage
    const comment = `/* traceId='${traceId}',spanId='${spanId}',route='${route}' */`;
    return `${comment} ${sql.trim()}`;
  }
}
