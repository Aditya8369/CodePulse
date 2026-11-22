import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyService } from './api-key.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { Reflector } from '@nestjs/core';

describe('ApiKeyController', () => {
  let controller: ApiKeyController;
  let service: jest.Mocked<Partial<ApiKeyService>>;

  beforeEach(async () => {
    service = {
      createApiKey: jest.fn(),
      listApiKeys: jest.fn(),
      revokeApiKey: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeyController],
      providers: [
        { provide: ApiKeyService, useValue: service },
        { provide: ApiKeyGuard, useValue: {} },
        Reflector,
      ],
    }).compile();

    controller = module.get<ApiKeyController>(ApiKeyController);
  });

  it('delegates createApiKey to ApiKeyService with authenticated userId', async () => {
    const mockRes = {
      id: 'key-123',
      name: 'CI Key',
      key: 'cp_live_0123456789abcdef0123456789abcdef01234567',
      keyPrefix: 'cp_live_01234567',
      scopes: ['read:analytics'],
      rateLimit: 1000,
      expiresAt: null,
      createdAt: new Date(),
    };
    (service.createApiKey as jest.Mock).mockResolvedValue(mockRes);

    const req = { user: { id: 'user-xyz' } };
    const dto = { name: 'CI Key', scopes: ['read:analytics'] };
    const result = await controller.createApiKey(req, dto);

    expect(result).toBe(mockRes);
    expect(service.createApiKey).toHaveBeenCalledWith('user-xyz', dto);
  });

  it('delegates listApiKeys to ApiKeyService', async () => {
    const mockList = [
      {
        id: 'key-1',
        name: 'Key 1',
        keyPrefix: 'cp_live_abc',
        scopes: ['read:analytics'],
        rateLimit: 1000,
        expiresAt: null,
        lastUsedAt: null,
        requestCount: 0,
        createdAt: new Date(),
      },
    ];
    (service.listApiKeys as jest.Mock).mockResolvedValue(mockList);

    const req = { user: { id: 'user-xyz' } };
    const result = await controller.listApiKeys(req);

    expect(result).toBe(mockList);
    expect(service.listApiKeys).toHaveBeenCalledWith('user-xyz');
  });

  it('delegates revokeApiKey to ApiKeyService', async () => {
    (service.revokeApiKey as jest.Mock).mockResolvedValue({
      success: true,
      message: 'API key revoked successfully',
    });

    const req = { user: { id: 'user-xyz' } };
    const result = await controller.revokeApiKey(req, 'key-123');

    expect(result.success).toBe(true);
    expect(service.revokeApiKey).toHaveBeenCalledWith('user-xyz', 'key-123');
  });

  it('introspects verified API key details on verify endpoint', async () => {
    const req = {
      apiKey: {
        id: 'key-123',
        name: 'Verified Key',
        keyPrefix: 'cp_live_verified',
        scopes: ['read:analytics'],
        rateLimit: 1000,
        expiresAt: null,
        lastUsedAt: new Date(),
        requestCount: 5,
        userId: 'user-xyz',
      },
      user: {
        id: 'user-xyz',
        username: 'devcoder',
      },
    };

    const res = await controller.verifyKey(req);
    expect(res.valid).toBe(true);
    expect(res.id).toBe('key-123');
    expect(res.user.username).toBe('devcoder');
  });
});

