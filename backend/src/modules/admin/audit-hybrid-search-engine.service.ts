import { Injectable, Logger } from '@nestjs/common';

export interface AuditLog {
  id: string;
  action: string;
  actor: string;
  details: string;
  tags: string[];
}

@Injectable()
export class AuditHybridSearchEngineService {
  private readonly logger = new Logger(AuditHybridSearchEngineService.name);

  public searchLogs(logs: AuditLog[], keyword: string, requiredTag?: string): AuditLog[] {
    const term = keyword.toLowerCase();
    return logs.filter(l => {
      const matchesKeyword = l.action.toLowerCase().includes(term) ||
                             l.actor.toLowerCase().includes(term) ||
                             l.details.toLowerCase().includes(term);
      const matchesTag = !requiredTag || l.tags.includes(requiredTag);
      return matchesKeyword && matchesTag;
    });
  }
}
