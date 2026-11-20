import { Module } from '@nestjs/common';
import { CodepulseMcpServer } from './codepulse-mcp.server';
import { McpController } from './mcp.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [McpController],
  providers: [CodepulseMcpServer],
  exports: [CodepulseMcpServer],
})
export class McpModule {}
