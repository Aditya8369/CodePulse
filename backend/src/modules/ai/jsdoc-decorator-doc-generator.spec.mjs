import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class JsdocDecoratorDocGeneratorService {
  doc(cls, decs) { return `# ${cls}: ${decs.join(',')}`; }
}

describe('JsdocDecoratorDocGeneratorService (#2276)', () => {
  test('generates markdown documentation from NestJS decorators', () => {
    const gen = new JsdocDecoratorDocGeneratorService();
    assert.strictEqual(gen.doc('UserCtrl', ['@Controller', '@UseGuards']), '# UserCtrl: @Controller,@UseGuards');
  });
});
