import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RouteMetricParamNormalizerService {
  private readonly logger = new Logger(RouteMetricParamNormalizerService.name);

  public normalizePath(rawPath: string): string {
    return rawPath
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/[0-9]+/g, '/:id');
  }
}
