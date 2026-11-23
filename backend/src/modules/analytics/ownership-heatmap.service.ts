import { Injectable } from '@nestjs/common';
import * as path from 'path';

export interface BlameCommitTouch {
  commitSha: string;
  authorId: string;
  authorName: string;
  filePath: string;
  timestampIso: string;
  diffLines: string[];
}

export interface DeveloperOwnershipShare {
  authorId: string;
  authorName: string;
  decayedWeight: number;
  ownershipPercent: number;
  lastCommitDaysAgo: number;
}

export interface DirectoryOwnershipNode {
  directoryPath: string;
  name: string;
  totalDecayedWeight: number;
  semanticLinesCount: number;
  busFactor: number;
  isCriticalBusFactorRisk: boolean; // >80% single developer & >60 days since their last commit
  riskReason: string | null;
  topOwner: DeveloperOwnershipShare | null;
  contributors: DeveloperOwnershipShare[];
  children: DirectoryOwnershipNode[];
}

export interface OnboardingKnowledgeRecommendation {
  directoryPath: string;
  priority: 'CRITICAL' | 'HIGH' | 'MODERATE';
  mentorAuthorName: string;
  mentorOwnershipPercent: number;
  inactiveDays: number;
  actionItem: string;
}

export interface OwnershipHeatmapReport {
  repositoryId: string;
  totalCommitsProcessed: number;
  semanticCommitsCount: number;
  filteredTrivialCommitsCount: number;
  executionTimeMs: number;
  decayLambdaPerDay: number;
  criticalRiskDirectories: DirectoryOwnershipNode[];
  rootTree: DirectoryOwnershipNode;
  onboardingRecommendations: OnboardingKnowledgeRecommendation[];
}

const MS_PER_DAY = 86_400_000;

@Injectable()
export class OwnershipHeatmapService {
  /**
   * Exponential temporal decay weight: W = lines * exp(-decay * elapsed_days)
   */
  computeDecayedWeight(
    semanticLines: number,
    elapsedDays: number,
    decayLambda = 0.015,
  ): number {
    if (semanticLines <= 0) return 0;
    const safeDays = Math.max(0, elapsedDays);
    return semanticLines * Math.exp(-decayLambda * safeDays);
  }

  /**
   * AST / Semantic diff inspection filtering out trivial non-semantic lines:
   * - pure whitespace / blank lines
   * - single-line or block comments
   * - import/re-export boilerplate
   * - brace-only / semicolon-only formatting churn
   */
  extractSemanticLineCount(diffLines: string[]): number {
    if (!Array.isArray(diffLines) || diffLines.length === 0) return 0;

    let semanticLines = 0;
    const strippedNormalizations = new Set<string>();

    for (const rawLine of diffLines) {
      // Strip leading git diff +/- marker
      const content = rawLine.replace(/^[+-]/, '').trim();
      if (!content) continue;

      // Ignore comment-only lines
      if (
        content.startsWith('//') ||
        content.startsWith('/*') ||
        content.startsWith('*') ||
        content.endsWith('*/') ||
        content.startsWith('#')
      ) {
        continue;
      }

      // Ignore import-only statements
      if (/^import\s+/.test(content) || /^from\s+['"]/.test(content)) {
        continue;
      }

      // Ignore brace/bracket/punctuation-only formatting lines
      if (/^[{}\[\]();,]+$/.test(content)) {
        continue;
      }

      // Collapse internal whitespace to detect pure re-indentation / prettier wrapping
      const canonicalAstToken = content.replace(/\s+/g, ' ');
      if (rawLine.startsWith('-')) {
        strippedNormalizations.add(canonicalAstToken);
        continue;
      }

      if (rawLine.startsWith('+') && strippedNormalizations.has(canonicalAstToken)) {
        // Pure whitespace/formatting move of identical statement
        strippedNormalizations.delete(canonicalAstToken);
        continue;
      }

      semanticLines += 1;
    }

    return semanticLines;
  }

  /**
   * Computes temporal decay-weighted ownership across up to 10,000+ commits,
   * identifies critical Bus Factor risk modules (>80% single author & >60 days stale),
   * builds hierarchical directory tree for Sunburst drill-down, and generates
   * onboarding knowledge-sharing recommendations.
   */
  analyzeOwnershipHeatmap(params: {
    repositoryId: string;
    commits: BlameCommitTouch[];
    asOfIso?: string;
    decayLambda?: number;
  }): OwnershipHeatmapReport {
    const t0 = performance.now();
    const asOfMs = params.asOfIso ? Date.parse(params.asOfIso) : Date.now();
    const decayLambda = params.decayLambda ?? 0.015;

    let semanticCommitsCount = 0;
    let filteredTrivialCommitsCount = 0;

    // dirPath -> authorId -> { authorName, weight, minDaysAgo, lines }
    const dirAuthorStats = new Map<
      string,
      Map<
        string,
        { authorId: string; authorName: string; weight: number; minDaysAgo: number; lines: number }
      >
    >();

    const ensureDirAuthor = (dirPath: string, authorId: string, authorName: string) => {
      let authorMap = dirAuthorStats.get(dirPath);
      if (!authorMap) {
        authorMap = new Map();
        dirAuthorStats.set(dirPath, authorMap);
      }
      let entry = authorMap.get(authorId);
      if (!entry) {
        entry = {
          authorId,
          authorName,
          weight: 0,
          minDaysAgo: Number.POSITIVE_INFINITY,
          lines: 0,
        };
        authorMap.set(authorId, entry);
      }
      return entry;
    };

    for (const commit of params.commits) {
      const semanticLines = this.extractSemanticLineCount(commit.diffLines);
      if (semanticLines <= 0) {
        filteredTrivialCommitsCount += 1;
        continue;
      }

      semanticCommitsCount += 1;
      const commitMs = Date.parse(commit.timestampIso);
      const elapsedDays = Number.isNaN(commitMs)
        ? 0
        : Math.max(0, (asOfMs - commitMs) / MS_PER_DAY);

      const weight = this.computeDecayedWeight(semanticLines, elapsedDays, decayLambda);
      const normalizedFile = commit.filePath.replace(/\\/g, '/').replace(/^\.\//, '');
      const dirName = path.posix.dirname(normalizedFile);

      // Propagate ownership weight up all ancestor directories to root "."
      const segments = dirName === '.' ? [] : dirName.split('/');
      const ancestorPaths = ['.'];
      let running = '';
      for (const seg of segments) {
        running = running ? `${running}/${seg}` : seg;
        ancestorPaths.push(running);
      }

      for (const anc of ancestorPaths) {
        const stat = ensureDirAuthor(anc, commit.authorId, commit.authorName);
        stat.weight += weight;
        stat.lines += semanticLines;
        if (elapsedDays < stat.minDaysAgo) {
          stat.minDaysAgo = elapsedDays;
        }
      }
    }

    // Build DirectoryOwnershipNode lookup
    const nodeLookup = new Map<string, DirectoryOwnershipNode>();
    if (!dirAuthorStats.has('.')) {
      dirAuthorStats.set('.', new Map());
    }

    for (const [dirPath, authorMap] of dirAuthorStats.entries()) {
      const entries = Array.from(authorMap.values());
      const totalWeight = entries.reduce((acc, e) => acc + e.weight, 0);
      const totalLines = entries.reduce((acc, e) => acc + e.lines, 0);

      const contributors: DeveloperOwnershipShare[] = entries
        .map((e) => ({
          authorId: e.authorId,
          authorName: e.authorName,
          decayedWeight: Number(e.weight.toFixed(3)),
          ownershipPercent:
            totalWeight > 0 ? Number(((e.weight / totalWeight) * 100).toFixed(1)) : 0,
          lastCommitDaysAgo: Number.isFinite(e.minDaysAgo) ? Math.round(e.minDaysAgo) : 0,
        }))
        .sort((a, b) => b.decayedWeight - a.decayedWeight);

      // Bus Factor = minimum developers needed to account for >= 50% of active ownership weight
      let accumPct = 0;
      let busFactor = 0;
      for (const c of contributors) {
        accumPct += c.ownershipPercent;
        busFactor += 1;
        if (accumPct >= 50) break;
      }

      const topOwner = contributors[0] ?? null;
      const isCriticalBusFactorRisk = Boolean(
        topOwner &&
          topOwner.ownershipPercent > 80 &&
          topOwner.lastCommitDaysAgo > 60 &&
          dirPath !== '.',
      );

      const riskReason = isCriticalBusFactorRisk
        ? `Critical Bus Factor (1): ${topOwner!.authorName} owns ${topOwner!.ownershipPercent}% of active code and has not committed in ${topOwner!.lastCommitDaysAgo} days.`
        : null;

      nodeLookup.set(dirPath, {
        directoryPath: dirPath,
        name: dirPath === '.' ? params.repositoryId : path.posix.basename(dirPath),
        totalDecayedWeight: Number(totalWeight.toFixed(3)),
        semanticLinesCount: totalLines,
        busFactor,
        isCriticalBusFactorRisk,
        riskReason,
        topOwner,
        contributors,
        children: [],
      });
    }

    // Wire parent -> child hierarchy
    for (const [dirPath, node] of nodeLookup.entries()) {
      if (dirPath === '.') continue;
      const parentPath = path.posix.dirname(dirPath);
      const parentNode = nodeLookup.get(parentPath) ?? nodeLookup.get('.');
      parentNode?.children.push(node);
    }

    for (const node of nodeLookup.values()) {
      node.children.sort((a, b) => b.totalDecayedWeight - a.totalDecayedWeight);
    }

    const criticalRiskDirectories = Array.from(nodeLookup.values())
      .filter((n) => n.isCriticalBusFactorRisk)
      .sort((a, b) => (b.topOwner?.ownershipPercent ?? 0) - (a.topOwner?.ownershipPercent ?? 0));

    const onboardingRecommendations = this.generateOnboardingRecommendations(
      Array.from(nodeLookup.values()),
    );

    const executionTimeMs = Number((performance.now() - t0).toFixed(2));

    return {
      repositoryId: params.repositoryId,
      totalCommitsProcessed: params.commits.length,
      semanticCommitsCount,
      filteredTrivialCommitsCount,
      executionTimeMs,
      decayLambdaPerDay: decayLambda,
      criticalRiskDirectories,
      rootTree: nodeLookup.get('.')!,
      onboardingRecommendations,
    };
  }

  /**
   * Generates automated knowledge-sharing recommendations for onboarding developers
   * targeting high-concentration or stale single-owner directories.
   */
  generateOnboardingRecommendations(
    nodes: DirectoryOwnershipNode[],
  ): OnboardingKnowledgeRecommendation[] {
    const recs: OnboardingKnowledgeRecommendation[] = [];

    for (const node of nodes) {
      if (node.directoryPath === '.' || !node.topOwner) continue;
      if (node.isCriticalBusFactorRisk) {
        recs.push({
          directoryPath: node.directoryPath,
          priority: 'CRITICAL',
          mentorAuthorName: node.topOwner.authorName,
          mentorOwnershipPercent: node.topOwner.ownershipPercent,
          inactiveDays: node.topOwner.lastCommitDaysAgo,
          actionItem: `Schedule architecture walkthrough of "${node.directoryPath}" with ${node.topOwner.authorName} (${node.topOwner.ownershipPercent}% owner, ${node.topOwner.lastCommitDaysAgo}d inactive) and assign 2 onboarding co-reviewers.`,
        });
      } else if (node.topOwner.ownershipPercent >= 70) {
        recs.push({
          directoryPath: node.directoryPath,
          priority: 'HIGH',
          mentorAuthorName: node.topOwner.authorName,
          mentorOwnershipPercent: node.topOwner.ownershipPercent,
          inactiveDays: node.topOwner.lastCommitDaysAgo,
          actionItem: `Pair onboarding contributors with ${node.topOwner.authorName} on "${node.directoryPath}" PRs to raise Bus Factor from 1 to 2.`,
        });
      }
    }

    return recs.sort((a, b) => b.mentorOwnershipPercent - a.mentorOwnershipPercent);
  }
}
