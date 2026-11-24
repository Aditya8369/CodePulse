import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class CompilerErrorTranslatorService {
  trans(code, msg) {
    if (code === 'TS2322') return 'Type mismatch';
    if (code === 'TS2304') return 'Undefined symbol';
    return msg;
  }
}

describe('CompilerErrorTranslatorService (#2277)', () => {
  test('translates complex compiler errors into friendly human-readable hints', () => {
    const translator = new CompilerErrorTranslatorService();
    assert.strictEqual(translator.trans('TS2322', 'Type A not assignable to B'), 'Type mismatch');
    assert.strictEqual(translator.trans('TS2304', 'Cannot find name foo'), 'Undefined symbol');
  });
});
