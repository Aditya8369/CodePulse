import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class Neo4jCartesianFreezeResolverService {
  private readonly logger = new Logger(Neo4jCartesianFreezeResolverService.name);

  public optimizeQuery(cypherQuery: string): { hasRisk: boolean; optimizedQuery: string } {
    // If query has MATCH (a), (b) without connecting pattern or WHERE relation, flag risk
    const isCartesian = cypherQuery.includes('MATCH') && cypherQuery.includes(',') && !cypherQuery.includes('-[');

    if (isCartesian) {
      this.logger.warn('Detected disconnected MATCH clauses risking Cartesian product freeze. Injecting WITH boundary.');
      const optimized = cypherQuery.replace(',', ' WITH u MATCH');
      return { hasRisk: true, optimizedQuery: optimized };
    }

    return { hasRisk: false, optimizedQuery: cypherQuery };
  }
}
