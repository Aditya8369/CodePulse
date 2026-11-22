import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

export interface OpenApi31Document extends Omit<OpenAPIObject, 'openapi'> {
  openapi: '3.1.0';
  jsonSchemaDialect: string;
}

export function buildOpenApi31Document(app: INestApplication): OpenApi31Document {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CodePulse Enterprise API')
    .setDescription(
      'Developer analytics, competitive coding battles, repository telemetry, and gamification platform API.',
    )
    .setVersion('1.0.0')
    .addServer('http://localhost:3001/api/v1', 'Local Development Server')
    .addServer('https://api.codepulse.dev/api/v1', 'Production Cloud Gateway')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token obtained from /auth/login or /auth/github',
      },
      'bearerAuth',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Enterprise service-to-service API key',
      },
      'apiKeyAuth',
    )
    .addTag('auth', 'Authentication, OAuth, Passkeys & Enterprise SSO')
    .addTag('users', 'Developer profiles, ratings & stats')
    .addTag('repositories', 'GitHub repository indexing & telemetry')
    .addTag('battles', 'Real-time developer coding battles')
    .addTag('leaderboards', 'Global & seasonal rankings')
    .addTag('graphql', 'Federated GraphQL gateway')
    .build();

  const rawDocument = SwaggerModule.createDocument(app, swaggerConfig);
  const upgraded = upgradeDocumentToOpenApi31(rawDocument);

  // Ensure baseline core paths & schemas exist for SDK generation even in standalone schema mode
  if (!upgraded.paths['/health']) {
    upgraded.paths['/health'] = {
      get: {
        operationId: 'getSystemHealth',
        summary: 'Check API liveness and version status',
        tags: ['health'],
        responses: {
          '200': {
            description: 'Service healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthStatusDto' },
              },
            },
          },
        },
      },
    };
  }

  if (!upgraded.paths['/users/{username}']) {
    upgraded.paths['/users/{username}'] = {
      get: {
        operationId: 'getDeveloperByUsername',
        summary: 'Fetch developer profile and analytics summary',
        tags: ['users'],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        parameters: [
          {
            name: 'username',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Developer profile payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DeveloperProfileDto' },
              },
            },
          },
        },
      },
    };
  }

  upgraded.components = upgraded.components ?? {};
  upgraded.components.schemas = {
    HealthStatusDto: {
      type: 'object',
      required: ['status', 'version', 'timestamp'],
      properties: {
        status: { type: 'string', example: 'ok' },
        version: { type: 'string', example: '1.0.0' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
    DeveloperProfileDto: {
      type: 'object',
      required: ['id', 'username', 'xp', 'level'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        username: { type: 'string' },
        name: { type: ['string', 'null'] as any },
        avatar: { type: ['string', 'null'] as any },
        xp: { type: 'integer', minimum: 0 },
        level: { type: 'integer', minimum: 1 },
      },
    },
    ...(upgraded.components.schemas ?? {}),
  };

  return upgraded;
}

/**
 * Upgrades an OpenAPI 3.0.x NestJS Swagger document into strict OpenAPI 3.1.0
 * (JSON Schema 2020-12 dialect, nullable type arrays, and exclusiveMinimum/Maximum numbers).
 */
export function upgradeDocumentToOpenApi31(
  doc: OpenAPIObject,
): OpenApi31Document {
  const transformed = transformNodeTo31(
    JSON.parse(JSON.stringify(doc)),
  ) as Omit<OpenAPIObject, 'openapi'>;

  return {
    ...transformed,
    openapi: '3.1.0',
    jsonSchemaDialect: 'https://spec.openapis.org/oas/3.1/dialect/base',
  };
}

function transformNodeTo31(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(transformNodeTo31);
  }
  if (!node || typeof node !== 'object') {
    return node;
  }

  const record = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(record)) {
    if (k === 'nullable') continue;
    out[k] = transformNodeTo31(v);
  }

  if (record.nullable === true && typeof out.type === 'string') {
    out.type = [out.type, 'null'];
  }

  if (typeof out.exclusiveMinimum === 'boolean' && typeof out.minimum === 'number') {
    if (out.exclusiveMinimum) {
      out.exclusiveMinimum = out.minimum;
      delete out.minimum;
    } else {
      delete out.exclusiveMinimum;
    }
  }

  if (typeof out.exclusiveMaximum === 'boolean' && typeof out.maximum === 'number') {
    if (out.exclusiveMaximum) {
      out.exclusiveMaximum = out.maximum;
      delete out.maximum;
    } else {
      delete out.exclusiveMaximum;
    }
  }

  return out;
}

export function exportOpenApi31SpecToFile(
  document: OpenApi31Document,
  outputPath = path.resolve(process.cwd(), 'openapi/openapi-3.1.json'),
): string {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  return outputPath;
}
