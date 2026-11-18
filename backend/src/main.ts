import 'dotenv/config';
import { OtelTracerService } from './common/observability/otel-tracer.service';

// Initialize OpenTelemetry NodeSDK distributed tracing before application bootstrap
void OtelTracerService.getInstance().initSdk();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { TraceInterceptor } from './common/interceptors/trace.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global Prefix
  app.setGlobalPrefix('api/v1', { exclude: ['metrics'] });

  // CORS
  app.enableCors();

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global Interceptors
  app.useGlobalInterceptors(
    new TraceInterceptor(),
    new TransformInterceptor(),
  );

  // Swagger OpenAPI Configuration
  const config = new DocumentBuilder()
    .setTitle('CodePulse API')
    .setDescription('The enterprise backend for CodePulse platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://0.0.0.0:${port}/api/v1`);
  console.log(`Swagger documentation available at: http://0.0.0.0:${port}/api/docs`);
}
void bootstrap();
