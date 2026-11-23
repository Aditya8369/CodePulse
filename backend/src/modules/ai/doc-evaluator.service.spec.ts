import { DocEvaluatorService } from './doc-evaluator.service';

describe('DocEvaluatorService (Automated README & API Documentation Evaluator)', () => {
  let service: DocEvaluatorService;

  beforeEach(() => {
    service = new DocEvaluatorService();
  });

  const sampleCompleteReadme = `
# CodePulse

[![Build Status](https://img.shields.io/github/workflow/status/code-with-abhi-i5/CodePulse/ci)](https://github.com/code-with-abhi-i5/CodePulse)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

CodePulse is a real-time developer intelligence and competitive code arena platform built for high-velocity software engineering teams.

![Architecture Diagram](https://raw.githubusercontent.com/code-with-abhi-i5/CodePulse/main/docs/architecture.png)

## Installation

Ensure you have Node.js 20+ and Docker installed before continuing.

\`\`\`bash
git clone https://github.com/code-with-abhi-i5/CodePulse.git
cd CodePulse
npm install
\`\`\`

## Configuration

| Variable | Description | Default |
| --- | --- | --- |
| PORT | HTTP server port | 3000 |
| DATABASE_URL | PostgreSQL connection string | postgresql://localhost:5432/codepulse |
| JWT_SECRET | Authentication token signing secret | secret-key |

## Usage

Start the development server with live reload:

\`\`\`bash
npm run dev
\`\`\`

You can also run tests:

\`\`\`bash
npm test
\`\`\`

Check out the [Installation Guide](#installation) for details on dependencies.

## Contributing

We welcome community pull requests! Please review our guidelines before submitting a PR.

## License

This project is licensed under the MIT License.
`.trim();

  const sampleIncompleteReadme = `
# Random Project

This is a project without clear instructions.

Check out [Broken Link](http://localhost:3000/todo) and [Missing Section](#non-existent-anchor).
`.trim();

  describe('Section Parser', () => {
    it('parses all essential open-source documentation sections', () => {
      const sections = service.parseSections(sampleCompleteReadme);

      expect(sections.some((s) => s.name === 'title')).toBe(true);
      expect(sections.some((s) => s.name === 'installation')).toBe(true);
      expect(sections.some((s) => s.name === 'usage')).toBe(true);
      expect(sections.some((s) => s.name === 'contributing')).toBe(true);
      expect(sections.some((s) => s.name === 'license')).toBe(true);
      expect(sections.some((s) => s.name === 'env')).toBe(true);
    });

    it('identifies word count and generates constructive feedback for brief sections', () => {
      const sections = service.parseSections('# Title\n\n## Usage\nJust run it.');
      const usage = sections.find((s) => s.name === 'usage');

      expect(usage).toBeDefined();
      expect(usage?.wordCount).toBe(3);
      expect(usage?.suggestions.length).toBeGreaterThan(0);
      expect(usage?.suggestions[0]).toContain('too brief');
    });
  });

  describe('Critical Elements Detection', () => {
    it('detects executable code blocks with languages', () => {
      const blocks = service.detectCodeBlocks(sampleCompleteReadme);

      expect(blocks.length).toBe(3);
      expect(blocks[0].language).toBe('bash');
      expect(blocks[0].code).toContain('npm install');
    });

    it('detects environment variable tables and extracts keys', () => {
      const envTables = service.detectEnvTables(sampleCompleteReadme);

      expect(envTables.length).toBe(1);
      expect(envTables[0].variables).toContain('PORT');
      expect(envTables[0].variables).toContain('DATABASE_URL');
      expect(envTables[0].variables).toContain('JWT_SECRET');
    });

    it('detects status badges and screenshots separately', () => {
      const badges = service.detectBadges(sampleCompleteReadme);
      const visuals = service.detectVisualAssets(sampleCompleteReadme);

      expect(badges.length).toBe(2);
      expect(badges[0].url).toContain('shields.io');

      expect(visuals.length).toBe(1);
      expect(visuals[0].url).toContain('architecture.png');
    });
  });

  describe('Link Integrity & Hyperlink Validation', () => {
    it('validates anchor links matching document headings', () => {
      const sections = service.parseSections(sampleCompleteReadme);
      const links = service.extractAndValidateLinks(sampleCompleteReadme, sections);

      expect(links.totalLinks).toBeGreaterThan(0);
      expect(links.brokenLinks.length).toBe(0);
      expect(links.healthScore).toBe(100);
    });

    it('flags broken internal anchors and unconfigured placeholder URLs', () => {
      const sections = service.parseSections(sampleIncompleteReadme);
      const links = service.extractAndValidateLinks(sampleIncompleteReadme, sections);

      expect(links.brokenLinks.length).toBe(2);
      expect(links.brokenLinks.some((l) => l.url.includes('non-existent-anchor'))).toBe(true);
      expect(links.brokenLinks.some((l) => l.url.includes('localhost:3000'))).toBe(true);
    });
  });

  describe('Readability & Flesch-Kincaid NLP Analysis', () => {
    it('calculates Flesch Reading Ease and Grade Level', () => {
      const readability = service.calculateReadability(sampleCompleteReadme);

      expect(readability.totalWords).toBeGreaterThan(20);
      expect(readability.totalSentences).toBeGreaterThan(2);
      expect(readability.fleschReadingEase).toBeGreaterThan(15);
      expect(readability.fleschReadingEase).toBeLessThanOrEqual(100);
      expect(readability.fleschKincaidGrade).toBeGreaterThan(0);
      expect(readability.clarityScore).toBeGreaterThanOrEqual(50);
    });

    it('handles empty text gracefully', () => {
      const readability = service.calculateReadability('');
      expect(readability.fleschReadingEase).toBe(0);
      expect(readability.readingLevel).toBe('Empty Document');
    });
  });

  describe('Scoring Rubric & Evaluation Results', () => {
    it('awards high score (90-100, A+) for comprehensive documentation', () => {
      const result = service.evaluateDocumentation(sampleCompleteReadme, {
        id: 'repo-101',
        name: 'CodePulse',
      });

      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.grade).toBe('A+');
      expect(result.verdict).toContain('Exemplary');
      expect(result.checklist.length).toBeGreaterThan(5);
      expect(result.checklist.every((c) => c.status === 'PASS')).toBe(true);
      expect(result.elements.codeBlocksCount).toBe(3);
      expect(result.elements.hasEnvTable).toBe(true);
      expect(result.elements.badgesCount).toBe(2);
      expect(result.elements.visualAssetsCount).toBe(1);
    });

    it('deducts points and produces actionable checklist for missing sections', () => {
      const result = service.evaluateDocumentation(sampleIncompleteReadme, {
        id: 'repo-incomplete',
        name: 'Random Project',
      });

      expect(result.score).toBeLessThan(60);
      expect(['C', 'D', 'F']).toContain(result.grade);
      expect(result.guidanceSummary.length).toBeGreaterThan(0);

      const installCheck = result.checklist.find((c) => c.id === 'installation');
      expect(installCheck).toBeDefined();
      expect(installCheck?.status).toBe('FAIL');
      expect(installCheck?.guidance).toContain('Missing Installation');
    });
  });

  describe('Badge SVG Generator', () => {
    it('generates a valid Shields.io-compliant SVG badge with score and grade', () => {
      const svg = service.generateBadgeSvg(95, 'A+');

      expect(svg).toContain('<svg');
      expect(svg).toContain('docs score');
      expect(svg).toContain('95% A+');
      expect(svg).toContain('#10b981'); // Emerald for >= 90
    });

    it('uses amber/red colors for lower scores', () => {
      const svgWarning = service.generateBadgeSvg(72, 'B');
      expect(svgWarning).toContain('#f59e0b');

      const svgFail = service.generateBadgeSvg(45, 'F');
      expect(svgFail).toContain('#ef4444');
    });
  });
});
