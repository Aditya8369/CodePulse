import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as ts from 'typescript';

export interface GeneratedBattleQuestion {
  id: string;
  category: 'TypeScript' | 'JavaScript' | 'Python' | 'Rust' | 'Go';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  question: string;
  codeSnippet: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  isValidated: boolean;
}

@Injectable()
export class QuestionGeneratorService {
  private readonly logger = new Logger(QuestionGeneratorService.name);

  /**
   * Validates TypeScript / JavaScript syntax inside a sandboxed compiler transpile pass
   */
  validateSnippetSyntax(snippet: string): boolean {
    try {
      const result = ts.transpileModule(snippet, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          noEmitOnError: true,
        },
        reportDiagnostics: true,
      });

      const hasErrors = (result.diagnostics || []).some(
        d => d.category === ts.DiagnosticCategory.Error
      );

      return !hasErrors;
    } catch {
      return false;
    }
  }

  /**
   * Generates a new validated battle question
   */
  generateQuestion(category: GeneratedBattleQuestion['category'], difficulty: GeneratedBattleQuestion['difficulty']): GeneratedBattleQuestion {
    const candidateSnippet = `
function calculateBonus(level: number, streak: number): number {
  const multiplier = streak > 5 ? 1.5 : 1.0;
  return Math.floor(level * 50 * multiplier);
}
    `.trim();

    const isValid = this.validateSnippetSyntax(candidateSnippet);
    if (!isValid) {
      throw new BadRequestException('Generated snippet failed syntax validation check.');
    }

    return {
      id: `q_${Date.now()}`,
      category,
      difficulty,
      question: 'What is the return value of calculateBonus(4, 7)?',
      codeSnippet: candidateSnippet,
      options: ['200', '300', '250', '350'],
      correctIndex: 1, // 4 * 50 * 1.5 = 300
      explanation: 'Streak of 7 exceeds the threshold of 5, triggering the 1.5x multiplier. 4 * 50 * 1.5 = 300.',
      isValidated: true,
    };
  }
}
