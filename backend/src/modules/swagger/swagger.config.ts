import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('CodePulse Developer Platform API')
    .setDescription(
      'Official REST and WebSocket API documentation for developer analytics, battles, leaderboards, and guilds.'
    )
    .setVersion('1.0')
    .addTag('auth', 'Authentication and OAuth operations')
    .addTag('users', 'Developer profiles and ranking metrics')
    .addTag('battles', 'DevBattles matchmaking and live arena endpoints')
    .addTag('leaderboards', 'Competitive global and clan rankings')
    .addTag('guilds', 'Developer guilds, clans, and membership')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT authorization bearer token',
        in: 'header',
      },
      'JWT-auth'
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'CodePulse API Docs',
    customCss: '.swagger-ui .topbar { background-color: #0b0f19; }',
    swaggerOptions: {
      persistAuthorization: true,
      filter: true,
    },
  });
}
