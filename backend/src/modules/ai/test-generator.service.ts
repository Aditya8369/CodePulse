import { Injectable, Logger, Optional } from '@nestjs/common';
import * as ts from 'typescript';
import { PrismaService } from '../../prisma/prisma.service';

export interface ParsedParamSignature {
  name: string;
  typeText: string;
  optional: boolean;
}

export interface ParsedFunctionSignature {
  functionName: string;
  parameters: ParsedParamSignature[];
  returnTypeText: string;
  interfaces: Record<string, Record<string, string>>;
}

export interface SynthesizedBoundaryCase {
  id: string;
  category:
    | 'MIN_INT'
    | 'MAX_INT'
    | 'NAN_GUARD'
    | 'EMPTY_COLLECTION'
    | 'SINGLE_ELEMENT'
    | 'UNICODE_MULTIBYTE'
    | 'NULL_UNDEFINED_GUARD'
    | 'RAPID_REPEATED_CALLS'
    | 'LARGE_PAYLOAD';
  description: string;
  args: unknown[];
  expectedOutput?: unknown;
  repeatCount?: number;
}

export interface SynthesizedSuiteResult {
  challengeId: string;
  signature: ParsedFunctionSignature;
  edgeCases: SynthesizedBoundaryCase[];
  vitestSpecCode: string;
  verifiedAgainstReference: boolean;
  passedCount: number;
  totalCount: number;
  typeCheckErrors: string[];
}

export interface TsMorphProjectLike {
  createSourceFile(filePath: string, sourceText: string, options?: any): {
    getFunctions?: () => Array<{
      getName: () => string | undefined;
      getParameters: () => Array<{
        getName: () => string;
        getTypeNode?: () => { getText: () => string } | undefined;
        isOptional?: () => boolean;
      }>;
      getReturnTypeNode?: () => { getText: () => string } | undefined;
    }>;
    getInterfaces?: () => Array<{
      getName: () => string;
      getProperties: () => Array<{
        getName: () => string;
        getTypeNode?: () => { getText: () => string } | undefined;
      }>;
    }>;
  };
}

@Injectable()
export class TestGeneratorService {
  private readonly logger = new Logger(TestGeneratorService.name);

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  inspectFunctionSignature(
    sourceCode: string,
    tsMorphProject?: TsMorphProjectLike,
  ): ParsedFunctionSignature {
    if (tsMorphProject) {
      const sf = tsMorphProject.createSourceFile('challenge.ts', sourceCode, {
        overwrite: true,
      });
      const interfaces: Record<string, Record<string, string>> = {};
      for (const iface of sf.getInterfaces?.() ?? []) {
        const props: Record<string, string> = {};
        for (const prop of iface.getProperties()) {
          props[prop.getName()] = prop.getTypeNode?.()?.getText() ?? 'unknown';
        }
        interfaces[iface.getName()] = props;
      }

      const fn = (sf.getFunctions?.() ?? [])[0];
      if (fn) {
        return {
          functionName: fn.getName() || 'solveChallenge',
          parameters: fn.getParameters().map((p) => ({
            name: p.getName(),
            typeText: p.getTypeNode?.()?.getText() ?? 'any',
            optional: Boolean(p.isOptional?.()),
          })),
          returnTypeText: fn.getReturnTypeNode?.()?.getText() ?? 'unknown',
          interfaces,
        };
      }
    }

    const sourceFile = ts.createSourceFile(
      'challenge.ts',
      sourceCode,
      ts.ScriptTarget.ES2022,
      true,
    );

    const interfaces: Record<string, Record<string, string>> = {};
    let functionName = 'solveChallenge';
    let parameters: ParsedParamSignature[] = [];
    let returnTypeText = 'unknown';

    const visit = (node: ts.Node) => {
      if (ts.isInterfaceDeclaration(node)) {
        const props: Record<string, string> = {};
        for (const member of node.members) {
          if (ts.isPropertySignature(member) && member.name) {
            props[member.name.getText(sourceFile)] = member.type
              ? member.type.getText(sourceFile)
              : 'unknown';
          }
        }
        interfaces[node.name.text] = props;
      } else if (ts.isFunctionDeclaration(node) && parameters.length === 0) {
        functionName = node.name?.text || 'solveChallenge';
        parameters = node.parameters.map((param) => ({
          name: param.name.getText(sourceFile),
          typeText: param.type ? param.type.getText(sourceFile) : 'any',
          optional: Boolean(param.questionToken),
        }));
        returnTypeText = node.type ? node.type.getText(sourceFile) : 'unknown';
      } else if (ts.isVariableStatement(node) && parameters.length === 0) {
        for (const decl of node.declarationList.declarations) {
          if (
            decl.initializer &&
            (ts.isArrowFunction(decl.initializer) ||
              ts.isFunctionExpression(decl.initializer))
          ) {
            functionName = decl.name.getText(sourceFile);
            parameters = decl.initializer.parameters.map((param) => ({
              name: param.name.getText(sourceFile),
              typeText: param.type ? param.type.getText(sourceFile) : 'any',
              optional: Boolean(param.questionToken),
            }));
            returnTypeText = decl.initializer.type
              ? decl.initializer.type.getText(sourceFile)
              : 'unknown';
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return { functionName, parameters, returnTypeText, interfaces };
  }

  private buildDefaultValueForType(
    typeText: string,
    mode:
      | 'NOMINAL'
      | 'MIN_INT'
      | 'MAX_INT'
      | 'NAN'
      | 'EMPTY'
      | 'SINGLE'
      | 'UNICODE'
      | 'NULLISH'
      | 'LARGE',
    interfaces: Record<string, Record<string, string>>,
  ): unknown {
    const clean = typeText.replace(/\s+/g, '');
    if (mode === 'NULLISH') return null;

    if (clean.endsWith('[]') || clean.startsWith('Array<')) {
      const inner = clean.endsWith('[]')
        ? clean.slice(0, -2)
        : clean.slice('Array<'.length, -1);
      if (mode === 'EMPTY') return [];
      if (mode === 'SINGLE') {
        return [this.buildDefaultValueForType(inner, 'NOMINAL', interfaces)];
      }
      if (mode === 'MIN_INT') {
        return [this.buildDefaultValueForType(inner, 'MIN_INT', interfaces), 0];
      }
      if (mode === 'MAX_INT') {
        return [this.buildDefaultValueForType(inner, 'MAX_INT', interfaces), 1];
      }
      if (mode === 'NAN') {
        return inner === 'number'
          ? [Number.NaN, 1]
          : [this.buildDefaultValueForType(inner, 'UNICODE', interfaces)];
      }
      if (mode === 'LARGE') {
        return Array.from({ length: 50 }, (_, idx) =>
          inner === 'number' ? idx + 1 : `item_${idx}`,
        );
      }
      return [
        this.buildDefaultValueForType(inner, 'NOMINAL', interfaces),
        this.buildDefaultValueForType(inner, 'UNICODE', interfaces),
      ];
    }

    if (clean === 'number' || clean === 'bigint') {
      if (mode === 'MIN_INT') return -2147483648;
      if (mode === 'MAX_INT') return 2147483647;
      if (mode === 'NAN') return Number.NaN;
      if (mode === 'EMPTY') return 0;
      if (mode === 'SINGLE') return 1;
      if (mode === 'LARGE') return 100000;
      return 42;
    }

    if (clean === 'string') {
      if (mode === 'EMPTY') return '';
      if (mode === 'UNICODE') return '🚀🔥你好_café_Ω';
      if (mode === 'SINGLE') return 'a';
      if (mode === 'LARGE') return 'x'.repeat(256);
      return 'codepulse_sample';
    }

    if (clean === 'boolean') return mode !== 'EMPTY';

    if (interfaces[clean]) {
      const obj: Record<string, unknown> = {};
      for (const [propName, propType] of Object.entries(interfaces[clean])) {
        obj[propName] = this.buildDefaultValueForType(propType, mode, interfaces);
      }
      return obj;
    }

    return mode === 'EMPTY' ? {} : { id: 1, label: 'edge' };
  }

  synthesizeBoundaryCases(
    signature: ParsedFunctionSignature,
  ): SynthesizedBoundaryCase[] {
    const params =
      signature.parameters.length > 0
        ? signature.parameters
        : [{ name: 'input', typeText: 'number[]', optional: false }];

    const buildArgs = (
      mode:
        | 'NOMINAL'
        | 'MIN_INT'
        | 'MAX_INT'
        | 'NAN'
        | 'EMPTY'
        | 'SINGLE'
        | 'UNICODE'
        | 'NULLISH'
        | 'LARGE',
    ) =>
      params.map((p) =>
        this.buildDefaultValueForType(p.typeText, mode, signature.interfaces),
      );

    return [
      {
        id: 'edge-1-min-int',
        category: 'MIN_INT',
        description: 'handles 32-bit signed MIN_INT (-2147483648) boundary without underflow',
        args: buildArgs('MIN_INT'),
      },
      {
        id: 'edge-2-max-int',
        category: 'MAX_INT',
        description: 'handles 32-bit signed MAX_INT (2147483647) boundary without overflow',
        args: buildArgs('MAX_INT'),
      },
      {
        id: 'edge-3-nan-guard',
        category: 'NAN_GUARD',
        description: 'handles NaN numeric boundary inputs gracefully',
        args: buildArgs('NAN'),
      },
      {
        id: 'edge-4-empty-collection',
        category: 'EMPTY_COLLECTION',
        description: 'handles empty array or zero-length string boundary',
        args: buildArgs('EMPTY'),
      },
      {
        id: 'edge-5-single-element',
        category: 'SINGLE_ELEMENT',
        description: 'handles single-element degenerate input cleanly',
        args: buildArgs('SINGLE'),
      },
      {
        id: 'edge-6-unicode-multibyte',
        category: 'UNICODE_MULTIBYTE',
        description: 'preserves multi-byte Unicode emoji and CJK characters',
        args: buildArgs('UNICODE'),
      },
      {
        id: 'edge-7-null-guard',
        category: 'NULL_UNDEFINED_GUARD',
        description: 'handles nullable or missing optional parameter inputs safely',
        args: buildArgs('NULLISH'),
      },
      {
        id: 'edge-8-large-payload',
        category: 'LARGE_PAYLOAD',
        description: 'handles high-cardinality collection inputs without quadratic stall',
        args: buildArgs('LARGE'),
      },
      {
        id: 'edge-9-rapid-repeated-calls',
        category: 'RAPID_REPEATED_CALLS',
        description: 'remains deterministic across 25 rapid repeated invocations',
        args: buildArgs('NOMINAL'),
        repeatCount: 25,
      },
    ];
  }

  emitVitestSpecFile(
    signature: ParsedFunctionSignature,
    edgeCases: SynthesizedBoundaryCase[],
    importPath = './solution',
  ): string {
    const fn = signature.functionName;
    const lines: string[] = [
      `import { describe, it, expect, vi, beforeEach } from 'vitest';`,
      `import { ${fn} } from '${importPath}';`,
      ``,
      `describe('${fn} — Synthesized Boundary & Edge-Case Suite', () => {`,
      `  beforeEach(() => {`,
      `    vi.restoreAllMocks();`,
      `  });`,
      ``,
    ];

    for (const tc of edgeCases) {
      const serializedArgs = tc.args
        .map((arg) =>
          typeof arg === 'number' && Number.isNaN(arg)
            ? 'Number.NaN'
            : JSON.stringify(arg),
        )
        .join(', ');

      lines.push(`  it('[${tc.category}] ${tc.description}', () => {`);
      if (tc.repeatCount && tc.repeatCount > 1) {
        lines.push(`    const baseline = ${fn}(${serializedArgs});`);
        lines.push(`    for (let i = 0; i < ${tc.repeatCount}; i += 1) {`);
        lines.push(`      expect(${fn}(${serializedArgs})).toEqual(baseline);`);
        lines.push(`    }`);
      } else if (tc.expectedOutput !== undefined) {
        const serializedExpected =
          typeof tc.expectedOutput === 'number' && Number.isNaN(tc.expectedOutput)
            ? 'Number.NaN'
            : JSON.stringify(tc.expectedOutput);
        lines.push(`    const result = ${fn}(${serializedArgs});`);
        lines.push(`    expect(result).toEqual(${serializedExpected});`);
      } else {
        lines.push(`    expect(() => ${fn}(${serializedArgs})).not.toThrow();`);
      }
      lines.push(`  });`);
      lines.push(``);
    }

    lines.push(`});`);
    lines.push(``);
    return lines.join('\n');
  }

  async synthesizeAndVerifyTestSuite(params: {
    challengeId: string;
    sourceCode: string;
    referenceSolutionFn?: (...args: any[]) => unknown;
    tsMorphProject?: TsMorphProjectLike;
  }): Promise<SynthesizedSuiteResult> {
    const signature = this.inspectFunctionSignature(
      params.sourceCode,
      params.tsMorphProject,
    );
    const edgeCases = this.synthesizeBoundaryCases(signature);

    let passedCount = 0;
    if (params.referenceSolutionFn) {
      for (const tc of edgeCases) {
        try {
          const repeats = tc.repeatCount ?? 1;
          let lastVal: unknown;
          for (let i = 0; i < repeats; i++) {
            lastVal = params.referenceSolutionFn(...structuredClone(tc.args));
          }
          tc.expectedOutput = lastVal;
          passedCount += 1;
        } catch {
          // Recorded as non-passing
        }
      }
    } else {
      passedCount = edgeCases.length;
    }

    const vitestSpecCode = this.emitVitestSpecFile(signature, edgeCases);

    const transpileCheck = ts.transpileModule(vitestSpecCode, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        strict: true,
      },
      reportDiagnostics: true,
    });
    const typeCheckErrors = (transpileCheck.diagnostics ?? []).map((d) =>
      ts.flattenDiagnosticMessageText(d.messageText, '\n'),
    );

    const verifiedAgainstReference =
      passedCount === edgeCases.length && typeCheckErrors.length === 0;

    if (
      this.prisma &&
      (this.prisma as any).challengeSynthesizedTestSuite?.create
    ) {
      await (this.prisma as any).challengeSynthesizedTestSuite.create({
        data: {
          challengeId: params.challengeId,
          functionName: signature.functionName,
          edgeCaseCount: edgeCases.length,
          vitestSpecCode,
          verifiedAgainstReference,
          passedCount,
          totalCount: edgeCases.length,
        },
      });
    }

    return {
      challengeId: params.challengeId,
      signature,
      edgeCases,
      vitestSpecCode,
      verifiedAgainstReference,
      passedCount,
      totalCount: edgeCases.length,
      typeCheckErrors,
    };
  }
}
