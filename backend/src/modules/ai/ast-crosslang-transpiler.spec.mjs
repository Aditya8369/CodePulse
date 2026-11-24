import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AstCrosslangTranspilerService {
  py2ts(py) {
    return py
      .replace(/def ([a-zA-Z0-9_]+)\((.*?)\):/g, 'function $1($2) {')
      .replace(/print\((.*?)\)/g, 'console.log($1)');
  }
}

describe('AstCrosslangTranspilerService (#2284)', () => {
  test('transpiles basic Python function signatures into TypeScript equivalents', () => {
    const transpiler = new AstCrosslangTranspilerService();
    const ts = transpiler.py2ts('def solve(x):\n    print(x)');
    assert.ok(ts.includes('function solve(x) {'));
    assert.ok(ts.includes('console.log(x)'));
  });
});
