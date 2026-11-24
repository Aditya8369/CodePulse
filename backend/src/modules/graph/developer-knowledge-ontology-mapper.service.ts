import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DeveloperKnowledgeOntologyMapperService {
  private readonly logger = new Logger(DeveloperKnowledgeOntologyMapperService.name);
  private taxonomy = new Map<string, string>(); // child skill -> parent domain

  public registerSkillTaxonomy(skill: string, domain: string): void {
    this.taxonomy.set(skill.toLowerCase(), domain);
  }

  public mapSkillsToDomains(skills: string[]): Record<string, string[]> {
    const mapped: Record<string, string[]> = {};

    for (const skill of skills) {
      const domain = this.taxonomy.get(skill.toLowerCase()) || 'General';
      if (!mapped[domain]) mapped[domain] = [];
      mapped[domain].push(skill);
    }

    return mapped;
  }
}
