import { Injectable, Logger } from '@nestjs/common';

export interface DocSection {
  name: 'title' | 'description' | 'installation' | 'usage' | 'contributing' | 'license' | 'badges' | 'architecture' | 'env' | 'other';
  heading: string;
  level: number;
  content: string;
  wordCount: number;
  present: boolean;
  score: number; // 0 to 10
  suggestions: string[];
}

export interface ReadabilityMetrics {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  readingLevel: string;
  totalWords: number;
  totalSentences: number;
  totalSyllables: number;
  clarityScore: number; // 0 to 100
}

export interface DocLink {
  text: string;
  url: string;
  isInternal: boolean;
  isDead: boolean;
  reason?: string;
}

export interface LinkValidationResult {
  totalLinks: number;
  internalLinks: number;
  externalLinks: number;
  brokenLinks: DocLink[];
  validCount: number;
  healthScore: number; // 0 to 100
}

export interface DocChecklistItem {
  id: string;
  title: string;
  category: 'essential_section' | 'executable_code' | 'configuration' | 'visuals' | 'links' | 'readability';
  status: 'PASS' | 'WARN' | 'FAIL';
  scoreImpact: number;
  guidance: string;
}

export interface DocEvaluationResult {
  repositoryId?: string;
  repositoryName?: string;
  score: number; // 0 to 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  verdict: string;
  badgeUrl: string;
  badgeSvg: string;
  readability: ReadabilityMetrics;
  sections: {
    title: DocSection;
    description: DocSection;
    installation: DocSection;
    usage: DocSection;
    contributing: DocSection;
    license: DocSection;
    otherSections: DocSection[];
  };
  elements: {
    codeBlocksCount: number;
    hasSyntaxHighlighting: boolean;
    languages: string[];
    hasEnvTable: boolean;
    envVarsFound: string[];
    badgesCount: number;
    visualAssetsCount: number;
  };
  links: LinkValidationResult;
  checklist: DocChecklistItem[];
  guidanceSummary: string[];
}

@Injectable()
export class DocEvaluatorService {
  private readonly logger = new Logger(DocEvaluatorService.name);

  // =========================================================================
  // Primary Public API
  // =========================================================================

  /**
   * Evaluates repository README markdown document, assesses sections,
   * detects code blocks and env tables, calculates readability, and produces
   * a holistic Documentation Score (0-100) with badge SVG.
   */
  public evaluateDocumentation(
    markdown: string,
    repoContext?: { id?: string; name?: string },
  ): DocEvaluationResult {
    const trimmed = (markdown || '').trim();

    // 1. Parse sections
    const parsedSections = this.parseSections(trimmed);

    // 2. Detect critical elements
    const codeBlocks = this.detectCodeBlocks(trimmed);
    const envTables = this.detectEnvTables(trimmed);
    const badges = this.detectBadges(trimmed);
    const visuals = this.detectVisualAssets(trimmed);

    // 3. Link validation
    const links = this.extractAndValidateLinks(trimmed, parsedSections);

    // 4. NLP Readability (Flesch-Kincaid)
    const readability = this.calculateReadability(trimmed);

    // 5. Compute documentation score (0 - 100)
    const { score, checklist, guidanceSummary } = this.calculateScoreAndChecklist({
      sections: parsedSections,
      codeBlocks,
      envTables,
      badges,
      visuals,
      links,
      readability,
    });

    const grade = this.computeGrade(score);
    const verdict = this.computeVerdict(grade);

    const repoId = repoContext?.id || 'default-repo';
    const badgeUrl = `/api/v1/repositories/${repoId}/doc-score/badge.svg`;
    const badgeSvg = this.generateBadgeSvg(score, grade);

    return {
      repositoryId: repoContext?.id,
      repositoryName: repoContext?.name,
      score,
      grade,
      verdict,
      badgeUrl,
      badgeSvg,
      readability,
      sections: {
        title: parsedSections.find((s) => s.name === 'title') || this.createEmptySection('title', 'Project Title'),
        description: parsedSections.find((s) => s.name === 'description') || this.createEmptySection('description', 'Description'),
        installation: parsedSections.find((s) => s.name === 'installation') || this.createEmptySection('installation', 'Installation'),
        usage: parsedSections.find((s) => s.name === 'usage') || this.createEmptySection('usage', 'Usage & Examples'),
        contributing: parsedSections.find((s) => s.name === 'contributing') || this.createEmptySection('contributing', 'Contributing Guidelines'),
        license: parsedSections.find((s) => s.name === 'license') || this.createEmptySection('license', 'License'),
        otherSections: parsedSections.filter(
          (s) => !['title', 'description', 'installation', 'usage', 'contributing', 'license'].includes(s.name),
        ),
      },
      elements: {
        codeBlocksCount: codeBlocks.length,
        hasSyntaxHighlighting: codeBlocks.some((cb) => cb.language && cb.language.length > 0),
        languages: Array.from(new Set(codeBlocks.map((cb) => cb.language).filter(Boolean))),
        hasEnvTable: envTables.length > 0,
        envVarsFound: envTables.flatMap((et) => et.variables),
        badgesCount: badges.length,
        visualAssetsCount: visuals.length,
      },
      links,
      checklist,
      guidanceSummary,
    };
  }

  // =========================================================================
  // Section Parser
  // =========================================================================

  /**
   * Parses markdown into structured documentation sections according to headers.
   */
  public parseSections(markdown: string): DocSection[] {
    const lines = markdown.split('\n');
    const sections: DocSection[] = [];

    let currentSection: {
      name: DocSection['name'];
      heading: string;
      level: number;
      contentLines: string[];
    } | null = null;

    let hasSeenH1 = false;

    // Check for title at top without header or leading H1
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        // Save previous section if exists
        if (currentSection) {
          const content = currentSection.contentLines.join('\n').trim();
          sections.push(this.buildSectionObject(currentSection.name, currentSection.heading, currentSection.level, content));
        }

        const level = headingMatch[1].length;
        const headingText = headingMatch[2].trim();
        const sectionType = this.classifyHeading(headingText, level, !hasSeenH1);

        if (level === 1) {
          hasSeenH1 = true;
        }

        currentSection = {
          name: sectionType,
          heading: headingText,
          level,
          contentLines: [],
        };
      } else {
        if (currentSection) {
          currentSection.contentLines.push(line);
        } else if (line.trim().length > 0) {
          // Content before first header is treated as Title / Overview preamble
          currentSection = {
            name: 'description',
            heading: 'Overview',
            level: 1,
            contentLines: [line],
          };
        }
      }
    }

    if (currentSection) {
      const content = currentSection.contentLines.join('\n').trim();
      sections.push(this.buildSectionObject(currentSection.name, currentSection.heading, currentSection.level, content));
    }

    return sections;
  }

  private classifyHeading(heading: string, level: number, isFirst: boolean): DocSection['name'] {
    const lower = heading.toLowerCase();

    if (level === 1 && isFirst) {
      return 'title';
    }
    if (/\b(install|installation|setup|getting started|prerequisites|quickstart|quick start|getting-started)\b/i.test(lower)) {
      return 'installation';
    }
    if (/\b(usage|examples?|how to use|api|api reference|endpoints?|commands?|guide|docs|documentation)\b/i.test(lower)) {
      return 'usage';
    }
    if (/\b(contribut|contributing|development|community|code of conduct)\b/i.test(lower)) {
      return 'contributing';
    }
    if (/\b(license|licensing|copyright)\b/i.test(lower)) {
      return 'license';
    }
    if (/\b(env|environment|configuration|config|environment variables)\b/i.test(lower)) {
      return 'env';
    }
    if (/\b(architecture|design|structure|overview|about|summary)\b/i.test(lower)) {
      return 'description';
    }
    return 'other';
  }

  private buildSectionObject(
    name: DocSection['name'],
    heading: string,
    level: number,
    content: string,
  ): DocSection {
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const suggestions: string[] = [];
    let score = 10;

    if (wordCount < 10) {
      score = Math.max(2, score - 6);
      suggestions.push(`The ${heading} section is too brief (${wordCount} words). Elaborate with clearer details.`);
    }

    if (name === 'installation' && !/npm|pnpm|yarn|docker|cargo|pip|git|go run|make/i.test(content)) {
      score = Math.max(4, score - 4);
      suggestions.push('Include executable package manager or build commands (e.g., npm, docker, cargo).');
    }

    if (name === 'usage' && !/```/i.test(content)) {
      score = Math.max(5, score - 3);
      suggestions.push('Provide code examples or CLI command snippets in fenced code blocks.');
    }

    return {
      name,
      heading,
      level,
      content,
      wordCount,
      present: true,
      score,
      suggestions,
    };
  }

  private createEmptySection(name: DocSection['name'], heading: string): DocSection {
    return {
      name,
      heading,
      level: 2,
      content: '',
      wordCount: 0,
      present: false,
      score: 0,
      suggestions: [`Missing essential section: "${heading}". Add this section to improve maintainability.`],
    };
  }

  // =========================================================================
  // Critical Documentation Elements Detection
  // =========================================================================

  public detectCodeBlocks(markdown: string): Array<{ language: string; code: string; lineCount: number }> {
    const regex = /```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g;
    const blocks: Array<{ language: string; code: string; lineCount: number }> = [];
    let match;

    while ((match = regex.exec(markdown)) !== null) {
      const language = match[1]?.trim().toLowerCase() || '';
      const code = match[2]?.trim() || '';
      blocks.push({
        language,
        code,
        lineCount: code.split('\n').length,
      });
    }

    return blocks;
  }

  public detectEnvTables(markdown: string): Array<{ rawTable: string; variables: string[] }> {
    const tables: Array<{ rawTable: string; variables: string[] }> = [];
    // Match markdown tables
    const tableRegex = /\|(.+)\|\r?\n\|[-:\s|]+\|\r?\n((\|.*\|\r?\n?)+)/g;
    let match;

    while ((match = tableRegex.exec(markdown)) !== null) {
      const header = match[1].toLowerCase();
      const body = match[2];

      if (/variable|env|key|parameter|setting/i.test(header) || /PORT|DATABASE_URL|SECRET|API_KEY|TOKEN/i.test(body)) {
        const rows = body.trim().split('\n');
        const variables: string[] = [];

        for (const row of rows) {
          const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
          if (cells.length > 0 && /^[A-Z0-9_]+$/i.test(cells[0].replace(/[`*]/g, ''))) {
            variables.push(cells[0].replace(/[`*]/g, ''));
          }
        }

        tables.push({
          rawTable: match[0],
          variables,
        });
      }
    }

    return tables;
  }

  public detectBadges(markdown: string): Array<{ alt: string; url: string; raw: string }> {
    const badges: Array<{ alt: string; url: string; raw: string }> = [];
    // Match Markdown badge links: [![alt](badge_img)](link) or standalone ![alt](badge_img)
    const badgeRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+(?:shields\.io|badge|codecov|github\/workflow|npm|crates\.io|license)[^\s)]*)\)/gi;
    let match;

    while ((match = badgeRegex.exec(markdown)) !== null) {
      badges.push({
        alt: match[1],
        url: match[2],
        raw: match[0],
      });
    }

    return badges;
  }

  public detectVisualAssets(markdown: string): Array<{ alt: string; url: string }> {
    const visuals: Array<{ alt: string; url: string }> = [];
    // Match general images/screenshots (excluding small shield badges)
    const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|svg)[^\s)]*)\)/gi;
    let match;

    while ((match = imgRegex.exec(markdown)) !== null) {
      const url = match[2];
      // Filter out badges
      if (!/shields\.io|badgen\.net|codecov|travis-ci/i.test(url)) {
        visuals.push({
          alt: match[1],
          url,
        });
      }
    }

    return visuals;
  }

  // =========================================================================
  // Link Integrity & Hyperlink Validation
  // =========================================================================

  public extractAndValidateLinks(markdown: string, sections: DocSection[]): LinkValidationResult {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const internalHeadings = new Set(
      sections.map((s) =>
        s.heading
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-'),
      ),
    );

    let totalLinks = 0;
    let internalLinks = 0;
    let externalLinks = 0;
    const brokenLinks: DocLink[] = [];
    let match;

    while ((match = linkRegex.exec(markdown)) !== null) {
      const text = match[1].trim();
      const rawUrl = match[2].trim();

      // Skip image definitions like ![alt](url)
      if (match.index > 0 && markdown[match.index - 1] === '!') {
        continue;
      }

      totalLinks++;

      if (rawUrl.startsWith('#')) {
        internalLinks++;
        const targetAnchor = rawUrl.substring(1).toLowerCase();
        if (targetAnchor && !internalHeadings.has(targetAnchor) && !this.anchorMatchesAny(targetAnchor, sections)) {
          brokenLinks.push({
            text,
            url: rawUrl,
            isInternal: true,
            isDead: true,
            reason: `Internal anchor link "${rawUrl}" does not match any heading in the document.`,
          });
        }
      } else if (/^https?:\/\//i.test(rawUrl)) {
        externalLinks++;
        if (this.isSuspectDeadUrl(rawUrl)) {
          brokenLinks.push({
            text,
            url: rawUrl,
            isInternal: false,
            isDead: true,
            reason: `URL "${rawUrl}" contains an unconfigured placeholder or malformed domain.`,
          });
        }
      }
    }

    const validCount = Math.max(0, totalLinks - brokenLinks.length);
    const healthScore = totalLinks === 0 ? 100 : Math.round((validCount / totalLinks) * 100);

    return {
      totalLinks,
      internalLinks,
      externalLinks,
      brokenLinks,
      validCount,
      healthScore,
    };
  }

  private anchorMatchesAny(anchor: string, sections: DocSection[]): boolean {
    const normalized = anchor.replace(/-/g, ' ');
    return sections.some((s) => s.heading.toLowerCase().includes(normalized));
  }

  private isSuspectDeadUrl(url: string): boolean {
    // Flag unconfigured templates and non-existent test anchors
    return /localhost|127\.0\.0\.1|your-domain\.com|your-org|placeholder|example\.com\/broken|todo|CHANGEME|TODO/i.test(
      url,
    );
  }

  // =========================================================================
  // NLP & Flesch-Kincaid Readability Analysis
  // =========================================================================

  public calculateReadability(text: string): ReadabilityMetrics {
    // Strip code blocks and markdown symbols before calculating prose readability
    const sanitized = text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[#*>\-_|~]/g, ' ')
      .trim();

    const sentences = sanitized
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const words = sanitized
      .split(/\s+/)
      .map((w) => w.replace(/[^a-zA-Z]/g, '').toLowerCase())
      .filter((w) => w.length > 0);

    const totalWords = words.length;
    const totalSentences = Math.max(1, sentences.length);

    if (totalWords === 0) {
      return {
        fleschReadingEase: 0,
        fleschKincaidGrade: 0,
        readingLevel: 'Empty Document',
        totalWords: 0,
        totalSentences: 0,
        totalSyllables: 0,
        clarityScore: 0,
      };
    }

    let totalSyllables = 0;
    for (const word of words) {
      totalSyllables += this.countSyllables(word);
    }

    const wordsPerSentence = totalWords / totalSentences;
    const syllablesPerWord = totalSyllables / totalWords;

    // Flesch Reading Ease: 206.835 - (1.015 * ASL) - (84.6 * ASW)
    const rawFre = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
    const fleschReadingEase = Math.round(Math.max(0, Math.min(100, rawFre)) * 10) / 10;

    // Flesch-Kincaid Grade Level: (0.39 * ASL) + (11.8 * ASW) - 15.59
    const rawFkgl = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
    const fleschKincaidGrade = Math.round(Math.max(0, Math.min(20, rawFkgl)) * 10) / 10;

    let readingLevel = 'Plain English';
    if (fleschReadingEase >= 90) readingLevel = 'Very Easy';
    else if (fleschReadingEase >= 80) readingLevel = 'Easy';
    else if (fleschReadingEase >= 70) readingLevel = 'Fairly Easy';
    else if (fleschReadingEase >= 60) readingLevel = 'Plain English';
    else if (fleschReadingEase >= 50) readingLevel = 'Fairly Difficult';
    else if (fleschReadingEase >= 30) readingLevel = 'Difficult';
    else readingLevel = 'Very Confusing';

    // Clarity score optimal between 50-75 (technical documentation balance)
    let clarityScore = 100;
    if (fleschReadingEase < 40) {
      clarityScore -= (40 - fleschReadingEase) * 1.5;
    } else if (fleschReadingEase > 90) {
      clarityScore -= 10; // overly simplistic
    }

    return {
      fleschReadingEase,
      fleschKincaidGrade,
      readingLevel,
      totalWords,
      totalSentences,
      totalSyllables,
      clarityScore: Math.round(Math.max(10, Math.min(100, clarityScore))),
    };
  }

  private countSyllables(word: string): number {
    if (word.length <= 3) return 1;

    word = word.replace(/(?:[^laeiouy]|ed|es|e)$/, '');
    word = word.replace(/^y/, '');
    const vowels = word.match(/[aeiouy]{1,2}/g);
    return vowels ? Math.max(1, vowels.length) : 1;
  }

  // =========================================================================
  // Scoring Rubric & Checklist Synthesis
  // =========================================================================

  private calculateScoreAndChecklist(params: {
    sections: DocSection[];
    codeBlocks: any[];
    envTables: any[];
    badges: any[];
    visuals: any[];
    links: LinkValidationResult;
    readability: ReadabilityMetrics;
  }): { score: number; checklist: DocChecklistItem[]; guidanceSummary: string[] } {
    const { sections, codeBlocks, envTables, badges, visuals, links, readability } = params;

    let totalScore = 0;
    const checklist: DocChecklistItem[] = [];
    const guidanceSummary: string[] = [];

    // 1. Essential Sections (40 Points Max)
    const titleSec = sections.find((s) => s.name === 'title');
    const descSec = sections.find((s) => s.name === 'description');
    const installSec = sections.find((s) => s.name === 'installation');
    const usageSec = sections.find((s) => s.name === 'usage');
    const contribSec = sections.find((s) => s.name === 'contributing');
    const licenseSec = sections.find((s) => s.name === 'license');

    // Title & Description (10 pts)
    const descContentLength = (descSec?.wordCount || 0) + (titleSec?.wordCount || 0);
    if (titleSec && descContentLength > 10) {
      totalScore += 10;
      checklist.push({
        id: 'title_description',
        title: 'Project Title & Overview',
        category: 'essential_section',
        status: 'PASS',
        scoreImpact: 10,
        guidance: 'Clear project title and informative overview present.',
      });
    } else if (titleSec || descSec) {
      totalScore += 5;
      checklist.push({
        id: 'title_description',
        title: 'Project Title & Overview',
        category: 'essential_section',
        status: 'WARN',
        scoreImpact: 5,
        guidance: 'Project description is too short. Add a clear 2-3 sentence value proposition.',
      });
      guidanceSummary.push('Expand your project overview to help new developers understand the core use cases.');
    } else {
      checklist.push({
        id: 'title_description',
        title: 'Project Title & Overview',
        category: 'essential_section',
        status: 'FAIL',
        scoreImpact: 0,
        guidance: 'Missing project title or overview description.',
      });
      guidanceSummary.push('Add an H1 Title and an introductory paragraph explaining what the project does.');
    }

    // Installation (10 pts)
    if (installSec && installSec.wordCount >= 10) {
      totalScore += 10;
      checklist.push({
        id: 'installation',
        title: 'Installation & Setup Guide',
        category: 'essential_section',
        status: 'PASS',
        scoreImpact: 10,
        guidance: 'Detailed installation instructions provided.',
      });
    } else if (installSec) {
      totalScore += 5;
      checklist.push({
        id: 'installation',
        title: 'Installation & Setup Guide',
        category: 'essential_section',
        status: 'WARN',
        scoreImpact: 5,
        guidance: 'Installation section is present but lacks comprehensive prerequisites.',
      });
      guidanceSummary.push('Provide step-by-step installation instructions including runtime requirements.');
    } else {
      checklist.push({
        id: 'installation',
        title: 'Installation & Setup Guide',
        category: 'essential_section',
        status: 'FAIL',
        scoreImpact: 0,
        guidance: 'Missing Installation section. Developers need step-by-step setup instructions.',
      });
      guidanceSummary.push('Add a dedicated "## Installation" section with package manager or Docker commands.');
    }

    // Usage & API Reference (10 pts)
    if (usageSec && usageSec.wordCount >= 15) {
      totalScore += 10;
      checklist.push({
        id: 'usage',
        title: 'Usage Examples & API Reference',
        category: 'essential_section',
        status: 'PASS',
        scoreImpact: 10,
        guidance: 'Usage instructions and API examples present.',
      });
    } else if (usageSec) {
      totalScore += 5;
      checklist.push({
        id: 'usage',
        title: 'Usage Examples & API Reference',
        category: 'essential_section',
        status: 'WARN',
        scoreImpact: 5,
        guidance: 'Usage section is sparse. Include copy-pasteable examples or request/response payloads.',
      });
      guidanceSummary.push('Enhance the Usage section with practical code examples.');
    } else {
      checklist.push({
        id: 'usage',
        title: 'Usage Examples & API Reference',
        category: 'essential_section',
        status: 'FAIL',
        scoreImpact: 0,
        guidance: 'Missing Usage section. Developers cannot determine how to execute the project.',
      });
      guidanceSummary.push('Add a "## Usage" section illustrating core API endpoints or CLI usage.');
    }

    // Contributing & License (10 pts)
    const hasContrib = Boolean(contribSec);
    const hasLicense = Boolean(licenseSec);
    if (hasContrib && hasLicense) {
      totalScore += 10;
      checklist.push({
        id: 'contributing_license',
        title: 'Contributing Guidelines & License',
        category: 'essential_section',
        status: 'PASS',
        scoreImpact: 10,
        guidance: 'Both Contributing guidelines and open-source License information are defined.',
      });
    } else if (hasContrib || hasLicense) {
      totalScore += 5;
      checklist.push({
        id: 'contributing_license',
        title: 'Contributing Guidelines & License',
        category: 'essential_section',
        status: 'WARN',
        scoreImpact: 5,
        guidance: `Missing ${!hasContrib ? 'Contributing guidelines' : 'License statement'}.`,
      });
      guidanceSummary.push(`Document ${!hasContrib ? 'how contributors can submit pull requests' : 'an open-source license'}.`);
    } else {
      checklist.push({
        id: 'contributing_license',
        title: 'Contributing Guidelines & License',
        category: 'essential_section',
        status: 'FAIL',
        scoreImpact: 0,
        guidance: 'Missing both Contributing guidelines and License information.',
      });
      guidanceSummary.push('Add a "## Contributing" and "## License" section to clarify open-source terms.');
    }

    // 2. Executable Code Examples (10 pts)
    if (codeBlocks.length >= 2 && codeBlocks.some((cb) => cb.language)) {
      totalScore += 10;
      checklist.push({
        id: 'executable_code',
        title: 'Executable Code Examples',
        category: 'executable_code',
        status: 'PASS',
        scoreImpact: 10,
        guidance: `${codeBlocks.length} fenced code snippets found with syntax highlighting.`,
      });
    } else if (codeBlocks.length > 0) {
      totalScore += 5;
      checklist.push({
        id: 'executable_code',
        title: 'Executable Code Examples',
        category: 'executable_code',
        status: 'WARN',
        scoreImpact: 5,
        guidance: 'Code blocks found, but ensure language tags (e.g. ```bash, ```typescript) are specified.',
      });
    } else {
      checklist.push({
        id: 'executable_code',
        title: 'Executable Code Examples',
        category: 'executable_code',
        status: 'FAIL',
        scoreImpact: 0,
        guidance: 'No fenced code blocks found in documentation.',
      });
      guidanceSummary.push('Include executable code blocks illustrating quickstart and API usage.');
    }

    // 3. Environment Variable Table (10 pts)
    if (envTables.length > 0 && envTables[0].variables.length > 0) {
      totalScore += 10;
      checklist.push({
        id: 'environment_variables',
        title: 'Configuration / Environment Table',
        category: 'configuration',
        status: 'PASS',
        scoreImpact: 10,
        guidance: `Identified ${envTables[0].variables.length} environment variables in structured table.`,
      });
    } else {
      checklist.push({
        id: 'environment_variables',
        title: 'Configuration / Environment Table',
        category: 'configuration',
        status: 'WARN',
        scoreImpact: 0,
        guidance: 'No environment variables table found. A table listing .env keys improves setup clarity.',
      });
      guidanceSummary.push('Add an Environment Variables markdown table listing keys, descriptions, and defaults.');
    }

    // 4. Status Badges & Visuals (15 pts)
    let badgePoints = 0;
    if (badges.length > 0) badgePoints += 7;
    if (visuals.length > 0) badgePoints += 8;
    totalScore += badgePoints;

    checklist.push({
      id: 'badges_visuals',
      title: 'Badges & Visual Assets',
      category: 'visuals',
      status: badgePoints >= 15 ? 'PASS' : badgePoints > 0 ? 'WARN' : 'FAIL',
      scoreImpact: badgePoints,
      guidance: `Found ${badges.length} badges and ${visuals.length} visual screenshots/diagrams.`,
    });
    if (badges.length === 0) {
      guidanceSummary.push('Add build/CI/license badges at the top of your README for social proof.');
    }
    if (visuals.length === 0) {
      guidanceSummary.push('Include a screenshot, GIF, or architecture diagram to make the project visually engaging.');
    }

    // 5. Link Integrity (15 pts)
    if (links.brokenLinks.length === 0) {
      totalScore += 15;
      checklist.push({
        id: 'link_integrity',
        title: 'Markdown Hyperlink Health',
        category: 'links',
        status: 'PASS',
        scoreImpact: 15,
        guidance: `All ${links.totalLinks} links verified cleanly without dead anchors or placeholders.`,
      });
    } else {
      const deduction = Math.min(15, links.brokenLinks.length * 5);
      const linkPts = Math.max(0, 15 - deduction);
      totalScore += linkPts;
      checklist.push({
        id: 'link_integrity',
        title: 'Markdown Hyperlink Health',
        category: 'links',
        status: 'FAIL',
        scoreImpact: linkPts,
        guidance: `Found ${links.brokenLinks.length} dead, broken, or placeholder links.`,
      });
      guidanceSummary.push(`Fix ${links.brokenLinks.length} broken links: ${links.brokenLinks.map((l) => l.url).join(', ')}.`);
    }

    // 6. Readability & Clarity (10 pts)
    let readPts = 10;
    if (readability.fleschReadingEase < 15 || readability.fleschReadingEase > 95) {
      readPts = 5;
    }
    totalScore += readPts;

    checklist.push({
      id: 'readability',
      title: 'Readability & Language Clarity',
      category: 'readability',
      status: readPts === 10 ? 'PASS' : 'WARN',
      scoreImpact: readPts,
      guidance: `Flesch Reading Ease is ${readability.fleschReadingEase} (${readability.readingLevel}).`,
    });

    const finalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

    return {
      score: finalScore,
      checklist,
      guidanceSummary,
    };
  }

  private computeGrade(score: number): DocEvaluationResult['grade'] {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  private computeVerdict(grade: DocEvaluationResult['grade']): string {
    switch (grade) {
      case 'A+':
        return 'Exemplary Documentation: Comprehensive, well-structured, and highly readable.';
      case 'A':
        return 'Excellent Documentation: Covers all essential open-source standards.';
      case 'B':
        return 'Good Documentation: Complete basics with minor opportunities for enhancement.';
      case 'C':
        return 'Needs Improvement: Missing secondary sections or visual setup aids.';
      case 'D':
        return 'Deficient: Lacks essential setup, usage, or license documentation.';
      default:
        return 'Critical Gaps: README is incomplete or missing critical instructions.';
    }
  }

  // =========================================================================
  // Badge SVG Generator
  // =========================================================================

  public generateBadgeSvg(score: number, grade?: string): string {
    const assignedGrade = grade || this.computeGrade(score);

    let color = '#ef4444'; // Red
    if (score >= 90) color = '#10b981'; // Emerald
    else if (score >= 80) color = '#3b82f6'; // Blue
    else if (score >= 70) color = '#f59e0b'; // Amber
    else if (score >= 50) color = '#f97316'; // Orange

    const text = `${score}% ${assignedGrade}`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="130" height="20" role="img" aria-label="docs score: ${text}">
  <title>docs score: ${text}</title>
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="a">
    <rect width="130" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#a)">
    <rect width="68" height="20" fill="#2b2b2b"/>
    <rect x="68" width="62" height="20" fill="${color}"/>
    <rect width="130" height="20" fill="url(#b)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="350" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="560">docs score</text>
    <text x="350" y="140" transform="scale(.1)" fill="#fff" textLength="560">docs score</text>
    <text aria-hidden="true" x="980" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="500">${text}</text>
    <text x="980" y="140" transform="scale(.1)" fill="#fff" textLength="500">${text}</text>
  </g>
</svg>`;
  }
}
