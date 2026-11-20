import { QuestionGeneratorService } from './question-generator.service';

describe('QuestionGeneratorService - Sandboxed Question Synthesis', () => {
  let service: QuestionGeneratorService;

  beforeEach(() => {
    service = new QuestionGeneratorService();
  });

  it('validates correct TypeScript snippet syntax without errors', () => {
    const validSnippet = 'const add = (a: number, b: number): number => a + b;';
    expect(service.validateSnippetSyntax(validSnippet)).toBe(true);
  });

  it('rejects malformed syntax snippets', () => {
    const invalidSnippet = 'const wrong = (a number) => {';
    expect(service.validateSnippetSyntax(invalidSnippet)).toBe(false);
  });

  it('generates a question with 4 options and valid correctIndex', () => {
    const question = service.generateQuestion('TypeScript', 'Medium');
    expect(question.options.length).toBe(4);
    expect(question.correctIndex).toBeGreaterThanOrEqual(0);
    expect(question.correctIndex).toBeLessThan(4);
    expect(question.isValidated).toBe(true);
  });
});
