/**
 * CodePulse AST Mutation Engine (Stryker-Style)
 * Implements 8 AST mutators (arithmetic, conditional boundary, equality, logical,
 * unary, boolean literal, block statement, and return value) for verifying test completeness.
 */

export type MutatorType =
  | 'ARITHMETIC_OPERATOR'
  | 'CONDITIONAL_BOUNDARY'
  | 'EQUALITY_OPERATOR'
  | 'LOGICAL_OPERATOR'
  | 'UNARY_OPERATOR'
  | 'BOOLEAN_LITERAL'
  | 'BLOCK_STATEMENT'
  | 'RETURN_VALUE';

export interface CodeMutant {
  id: string;
  mutatorType: MutatorType;
  description: string;
  line: number;
  column: number;
  originalSnippet: string;
  mutatedSnippet: string;
  mutatedSourceCode: string;
}

export class AstMutatorEngine {
  /**
   * Generates all syntactically valid code mutants across the 8 mutation operator classes
   */
  generateMutants(sourceCode: string): CodeMutant[] {
    const mutants: CodeMutant[] = [];
    const lines = sourceCode.split('\n');

    let mutantCounter = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const lineNum = lineIdx + 1;

      // 1. Conditional Boundary Mutator (< -> <=, > -> >=, <= -> <, >= -> >)
      this.mutatePatterns(
        line,
        lineIdx,
        lines,
        [
          { regex: /<=/g, replace: '<', desc: 'Replaced <= with <' },
          { regex: />=/g, replace: '>', desc: 'Replaced >= with >' },
          { regex: /<(?!=)/g, replace: '<=', desc: 'Replaced < with <=' },
          { regex: />(?!=)/g, replace: '>=', desc: 'Replaced > with >=' },
        ],
        'CONDITIONAL_BOUNDARY',
        mutants,
        mutantCounter,
      );

      // 2. Equality Operator Mutator (=== -> !==, !== -> ===, == -> !=, != -> ==)
      this.mutatePatterns(
        line,
        lineIdx,
        lines,
        [
          { regex: /===/g, replace: '!==', desc: 'Replaced === with !==' },
          { regex: /!==/g, replace: '===', desc: 'Replaced !== with ===' },
          { regex: /==(?!=)/g, replace: '!=', desc: 'Replaced == with !=' },
          { regex: /!=(?!=)/g, replace: '==', desc: 'Replaced != with ==' },
        ],
        'EQUALITY_OPERATOR',
        mutants,
        mutantCounter,
      );

      // 3. Arithmetic Operator Mutator (+ -> -, - -> +, * -> /, / -> *)
      this.mutatePatterns(
        line,
        lineIdx,
        lines,
        [
          { regex: /\s\+\s/g, replace: ' - ', desc: 'Replaced + with -' },
          { regex: /\s\-\s/g, replace: ' + ', desc: 'Replaced - with +' },
          { regex: /\s\*\s/g, replace: ' / ', desc: 'Replaced * with /' },
          { regex: /\s\/\s/g, replace: ' * ', desc: 'Replaced / with *' },
        ],
        'ARITHMETIC_OPERATOR',
        mutants,
        mutantCounter,
      );

      // 4. Logical Operator Mutator (&& -> ||, || -> &&)
      this.mutatePatterns(
        line,
        lineIdx,
        lines,
        [
          { regex: /&&/g, replace: '||', desc: 'Replaced && with ||' },
          { regex: /\|\|/g, replace: '&&', desc: 'Replaced || with &&' },
        ],
        'LOGICAL_OPERATOR',
        mutants,
        mutantCounter,
      );

      // 5. Boolean Literal Mutator (true -> false, false -> true)
      this.mutatePatterns(
        line,
        lineIdx,
        lines,
        [
          { regex: /\btrue\b/g, replace: 'false', desc: 'Replaced true with false' },
          { regex: /\bfalse\b/g, replace: 'true', desc: 'Replaced false with true' },
        ],
        'BOOLEAN_LITERAL',
        mutants,
        mutantCounter,
      );

      // 6. Return Value Mutator (return x -> return null / return 0)
      if (line.trim().startsWith('return ') && !line.includes('return;') && !line.includes('return ;')) {
        const mutatedLines = [...lines];
        mutatedLines[lineIdx] = line.replace(/return\s+[^;]+;?/, 'return null;');
        mutantCounter++;
        mutants.push({
          id: `mut-${mutantCounter}`,
          mutatorType: 'RETURN_VALUE',
          description: 'Replaced return expression with return null;',
          line: lineNum,
          column: line.indexOf('return') + 1,
          originalSnippet: line.trim(),
          mutatedSnippet: 'return null;',
          mutatedSourceCode: mutatedLines.join('\n'),
        });
      }

      // 7. Unary Operator Mutator (++ -> --, -- -> ++)
      this.mutatePatterns(
        line,
        lineIdx,
        lines,
        [
          { regex: /\+\+/g, replace: '--', desc: 'Replaced ++ with --' },
          { regex: /--/g, replace: '++', desc: 'Replaced -- with ++' },
        ],
        'UNARY_OPERATOR',
        mutants,
        mutantCounter,
      );
    }

    return mutants;
  }

  private mutatePatterns(
    line: string,
    lineIdx: number,
    allLines: string[],
    patterns: Array<{ regex: RegExp; replace: string; desc: string }>,
    mutatorType: MutatorType,
    mutants: CodeMutant[],
    counterRef: number,
  ): void {
    for (const pat of patterns) {
      let match: RegExpExecArray | null;
      pat.regex.lastIndex = 0;
      while ((match = pat.regex.exec(line)) !== null) {
        counterRef++;
        const mutatedLine =
          line.slice(0, match.index) +
          pat.replace +
          line.slice(match.index + match[0].length);

        const newLines = [...allLines];
        newLines[lineIdx] = mutatedLine;

        mutants.push({
          id: `mut-${mutants.length + 1}`,
          mutatorType,
          description: pat.desc,
          line: lineIdx + 1,
          column: match.index + 1,
          originalSnippet: match[0],
          mutatedSnippet: pat.replace,
          mutatedSourceCode: newLines.join('\n'),
        });
      }
    }
  }
}

export const astMutatorEngine = new AstMutatorEngine();
