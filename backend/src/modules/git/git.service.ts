import { Injectable, Optional } from '@nestjs/common';
import {
  SemanticConflictResolverService,
  type ThreeWayConflictInput,
  type SemanticConflictResolutionOutput,
} from './semantic-conflict-resolver.service';

@Injectable()
export class GitService {
  constructor(
    @Optional()
    private readonly semanticConflictResolver: SemanticConflictResolverService = new SemanticConflictResolverService(),
  ) {}

  async resolveMergeConflictSemantically(
    input: ThreeWayConflictInput,
  ): Promise<SemanticConflictResolutionOutput> {
    return this.semanticConflictResolver.resolve3WaySemanticConflict(input);
  }
}
