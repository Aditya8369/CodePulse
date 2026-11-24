import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MonacoSnippetTelemetryService {
  private readonly logger = new Logger(MonacoSnippetTelemetryService.name);
  private usageCounts = new Map<string, number>();

  public recordSnippetUse(snippetKey: string): void {
    this.usageCounts.set(snippetKey, (this.usageCounts.get(snippetKey) || 0) + 1);
  }

  public getPopularity(snippetKey: string): number {
    return this.usageCounts.get(snippetKey) || 0;
  }
}
