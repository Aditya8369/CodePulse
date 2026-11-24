import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AstRealtimeFormatStreamService {
  private readonly logger = new Logger(AstRealtimeFormatStreamService.name);

  public formatSnippet(rawCode: string): string {
    return rawCode
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .join(';\n') + ';\n';
  }
}
