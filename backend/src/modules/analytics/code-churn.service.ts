import { Injectable } from '@nestjs/common';

export interface ChurnTimeSeriesPoint {
  date: string;
  additions: number;
  deletions: number;
  netDiff: number;
  refactoringRatio: number; // deletions / (additions + deletions)
}

export interface CodeChurnReport {
  repoOrAuthor: string;
  totalAdditions: number;
  totalDeletions: number;
  netCodeGrowth: number;
  overallRefactoringRatio: number;
  churnProfile: 'FEATURE_HEAVY' | 'REFACTORING_BALANCED' | 'CLEANUP_HEAVY';
  timeSeries: ChurnTimeSeriesPoint[];
}

@Injectable()
export class CodeChurnService {
  /**
   * Computes code churn metrics and refactoring efficiency ratios over commit time series
   */
  computeChurnReport(
    targetName: string,
    rawCommits: Array<{ date: string; additions: number; deletions: number }>
  ): CodeChurnReport {
    let totalAdditions = 0;
    let totalDeletions = 0;

    const timeSeries: ChurnTimeSeriesPoint[] = rawCommits.map(c => {
      totalAdditions += c.additions;
      totalDeletions += c.deletions;
      const totalChanges = c.additions + c.deletions;
      const refactoringRatio = totalChanges === 0 ? 0 : Number((c.deletions / totalChanges).toFixed(3));

      return {
        date: c.date,
        additions: c.additions,
        deletions: c.deletions,
        netDiff: c.additions - c.deletions,
        refactoringRatio,
      };
    });

    const combinedChanges = totalAdditions + totalDeletions;
    const overallRatio = combinedChanges === 0 ? 0 : Number((totalDeletions / combinedChanges).toFixed(3));

    let churnProfile: CodeChurnReport['churnProfile'] = 'REFACTORING_BALANCED';
    if (overallRatio < 0.25) {
      churnProfile = 'FEATURE_HEAVY';
    } else if (overallRatio > 0.55) {
      churnProfile = 'CLEANUP_HEAVY';
    }

    return {
      repoOrAuthor: targetName,
      totalAdditions,
      totalDeletions,
      netCodeGrowth: totalAdditions - totalDeletions,
      overallRefactoringRatio: overallRatio,
      churnProfile,
      timeSeries,
    };
  }
}
