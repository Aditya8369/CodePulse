import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CodepulseMcpServer } from './codepulse-mcp.server';

@ApiTags('mcp')
@Controller('mcp')
export class McpController {
  constructor(private readonly mcpServer: CodepulseMcpServer) {}

  @Get('manifest')
  @ApiOperation({ summary: 'Get Model Context Protocol (MCP) server manifest and capabilities' })
  getManifest() {
    return {
      name: 'codepulse-mcp-server',
      version: '1.0.0',
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: true,
        resources: true,
        prompts: false,
      },
      tools: this.mcpServer.tools,
      resources: this.mcpServer.resources,
    };
  }

  @Get('tools')
  @ApiOperation({ summary: 'List all registered MCP tools and their JSON schemas' })
  listTools() {
    return { tools: this.mcpServer.tools };
  }

  @Post('tools/call')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Call an MCP tool with structured arguments' })
  @ApiHeader({ name: 'x-mcp-api-key', required: false, description: 'CodePulse MCP API Key' })
  async callTool(
    @Body() body: { tool: string; arguments?: Record<string, unknown> },
    @Headers('x-mcp-api-key') apiKey?: string,
  ) {
    return this.mcpServer.executeTool(body.tool, body.arguments || {}, apiKey);
  }

  @Get('resources')
  @ApiOperation({ summary: 'List all registered MCP resource templates' })
  listResources() {
    return { resources: this.mcpServer.resources };
  }

  @Get('resources/read')
  @ApiOperation({ summary: 'Read an MCP resource by URI template' })
  @ApiHeader({ name: 'x-mcp-api-key', required: false, description: 'CodePulse MCP API Key' })
  async readResource(
    @Query('uri') uri: string,
    @Headers('x-mcp-api-key') apiKey?: string,
  ) {
    return this.mcpServer.readResource(uri, apiKey);
  }
}
