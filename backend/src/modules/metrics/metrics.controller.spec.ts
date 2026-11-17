import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { MetricsBasicAuthGuard } from './metrics-basic-auth.guard';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('GET /metrics', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        MetricsBasicAuthGuard,
        {
          provide: MetricsService,
          useValue: {
            contentType:
              'application/openmetrics-text; version=1.0.0; charset=utf-8',
            metrics: () =>
              Promise.resolve('ws_active_connections_total 1\n# EOF\n'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                METRICS_BASIC_AUTH_USER: 'scraper',
                METRICS_BASIC_AUTH_PASSWORD: 'secret-value',
              })[key],
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['metrics'] });
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => app.close());

  it('rejects unauthenticated scrapes and serves OpenMetrics at the unprefixed path', async () => {
    await request(app.getHttpServer()).get('/metrics').expect(401);
    const token = Buffer.from('scraper:secret-value').toString('base64');
    const response = await request(app.getHttpServer())
      .get('/metrics')
      .set('Authorization', `Basic ${token}`)
      .expect(200);
    expect(response.headers['content-type']).toContain(
      'application/openmetrics-text',
    );
    expect(response.text).toContain('ws_active_connections_total 1');
    await request(app.getHttpServer())
      .get('/api/v1/metrics')
      .set('Authorization', `Basic ${token}`)
      .expect(404);
  });
});
