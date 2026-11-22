import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { RequireScope } from '../../common/decorators/require-scope.decorator';
import { ApiKeyService } from './api-key.service';
import {
  CreateApiKeyDto,
  ApiKeyResponseDto,
  ApiKeyListItemDto,
} from './dto/api-key.dto';

@ApiTags('developer-api-keys')
@Controller(['api-keys', 'auth/api-keys'])
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Generate a new developer API key with granular scopes',
    description:
      'Creates a 40+ char cryptographically secure API key prefixed with cp_live_. The raw key is returned ONCE.',
  })
  @ApiResponse({
    status: 201,
    description: 'API key created successfully',
    type: ApiKeyResponseDto,
  })
  async createApiKey(
    @Req() req: any,
    @Body() dto: CreateApiKeyDto,
  ): Promise<ApiKeyResponseDto> {
    const userId = req.user?.id;
    return this.apiKeyService.createApiKey(userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List active developer API keys',
    description:
      'Returns active API keys for the developer with masked prefix, assigned scopes, and usage statistics.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active API keys retrieved successfully',
    type: [ApiKeyListItemDto],
  })
  async listApiKeys(@Req() req: any): Promise<ApiKeyListItemDto[]> {
    const userId = req.user?.id;
    return this.apiKeyService.listApiKeys(userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Revoke an existing developer API key',
    description: 'Permanently invalidates and deletes the specified API key.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the API key to revoke' })
  @ApiResponse({
    status: 200,
    description: 'API key revoked successfully',
  })
  async revokeApiKey(
    @Req() req: any,
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string }> {
    const userId = req.user?.id;
    return this.apiKeyService.revokeApiKey(userId, id);
  }

  @Get('verify')
  @UseGuards(ApiKeyGuard)
  @RequireScope('read:analytics')
  @ApiHeader({
    name: 'x-api-key',
    description: 'Developer API key with read:analytics scope',
    required: true,
  })
  @ApiOperation({
    summary: 'Verify developer API key and test scope-based guard',
    description:
      'Demonstrates and validates API key authentication and granular scope enforcement.',
  })
  @ApiResponse({
    status: 200,
    description: 'API key is valid and authorized',
  })
  async verifyKey(@Req() req: any) {
    return {
      valid: true,
      id: req.apiKey.id,
      name: req.apiKey.name,
      keyPrefix: req.apiKey.keyPrefix,
      scopes: req.apiKey.scopes,
      rateLimit: req.apiKey.rateLimit,
      expiresAt: req.apiKey.expiresAt,
      lastUsedAt: req.apiKey.lastUsedAt,
      requestCount: req.apiKey.requestCount,
      user: {
        id: req.user?.id,
        username: req.user?.username,
      },
    };
  }
}

