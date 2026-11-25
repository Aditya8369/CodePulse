import { describe, it } from 'node:test';
import assert from 'node:assert';
import { OpenApiSchemaGeneratorService } from './api-int-04.service.ts';

describe('OpenApiSchemaGeneratorService (API-INT-04)', () => {
  it('generates fully compliant OpenAPI 3.1 specifications', () => {
    const generator = new OpenApiSchemaGeneratorService();
    generator.registerEndpoint('/api/v1/challenges', 'GET', 'List challenges');

    const spec = generator.generateSpec();
    assert.strictEqual(spec.openapi, '3.1.0');
    assert.ok(spec.paths['/api/v1/challenges']['get']);
  });
});
