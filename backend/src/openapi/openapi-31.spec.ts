import { Test } from '@nestjs/testing';
import { Controller, Get } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildOpenApi31Document,
  exportOpenApi31SpecToFile,
} from './openapi-31.builder';

@Controller('users')
class DummyUsersController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

describe('OpenAPI 3.1.0 Specification & Multi-Language SDK Generator', () => {
  it('exports strict OpenAPI 3.1.0 schema with JSON Schema 2020-12 dialect and security schemes', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DummyUsersController],
    }).compile();

    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    const doc = buildOpenApi31Document(app);
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.jsonSchemaDialect).toBe(
      'https://spec.openapis.org/oas/3.1/dialect/base',
    );
    expect(doc.components?.securitySchemes).toHaveProperty('bearerAuth');
    expect(doc.components?.securitySchemes).toHaveProperty('apiKeyAuth');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codepulse-oas31-'));
    const specFile = exportOpenApi31SpecToFile(
      doc,
      path.join(tmpDir, 'openapi-3.1.json'),
    );
    expect(fs.existsSync(specFile)).toBe(true);

    await app.close();
  });

  it('generates TypeScript (@codepulse/sdk), Python (codepulse-py), and Go (codepulse-go) SDKs with auth & retry logic', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codepulse-sdks-'));
    const specFile = path.join(tmpDir, 'openapi-3.1.json');
    fs.writeFileSync(
      specFile,
      JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'CodePulse Enterprise API', version: '1.2.0' },
        paths: { '/health': { get: { operationId: 'getSystemHealth' } } },
      }),
      'utf8',
    );

    const generatorPath = path.resolve(
      process.cwd(),
      '../scripts/sdk-generator-core.mjs',
    );
    const { generateAllSdks } = await import(generatorPath);
    const outDir = path.join(tmpDir, 'sdks');
    const summary = generateAllSdks({ specPath: specFile, outputRoot: outDir });

    expect(summary.openapiVersion).toBe('3.1.0');
    expect(summary.sdkVersion).toBe('1.2.0');

    const tsCode = fs.readFileSync(
      path.join(outDir, 'typescript/src/index.ts'),
      'utf8',
    );
    expect(tsCode).toContain('class CodePulseClient');
    expect(tsCode).toContain('Authorization');
    expect(tsCode).toContain('X-API-Key');
    expect(tsCode).toContain('Retry-After');
    expect(tsCode).toContain('Math.pow(2, attempt)');

    const pyCode = fs.readFileSync(
      path.join(outDir, 'python/codepulse_py/client.py'),
      'utf8',
    );
    expect(pyCode).toContain('class CodePulseClient');
    expect(pyCode).toContain('Retry-After');
    expect(pyCode).toContain('2 ** attempt');

    const goCode = fs.readFileSync(path.join(outDir, 'go/client.go'), 'utf8');
    expect(goCode).toContain('package codepulse');
    expect(goCode).toContain('WithBearerToken');
    expect(goCode).toContain('WithAPIKey');
    expect(goCode).toContain('Retry-After');
  });
});
