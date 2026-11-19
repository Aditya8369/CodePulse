import { describe, it, expect, beforeEach } from 'vitest';

export interface McpToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export class McpProtocolValidator {
  private readonly rateLimits = new Map<string, number[]>();

  public verifyApiKey(apiKey?: string): boolean {
    if (!apiKey) return false;
    return apiKey.startsWith('cp_mcp_') && apiKey.length >= 24;
  }

  public checkRateLimit(id: string, maxReqs = 60, windowMs = 60000): boolean {
    const now = Date.now();
    const timestamps = (this.rateLimits.get(id) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= maxReqs) return false;
    timestamps.push(now);
    this.rateLimits.set(id, timestamps);
    return true;
  }

  public validateResourceUri(uri: string): { valid: boolean; type?: string; id?: string } {
    const repoMatch = uri.match(/^codepulse:\/\/repositories\/([^/]+)\/analytics$/);
    if (repoMatch) return { valid: true, type: 'repository', id: repoMatch[1] };
    if (uri === 'codepulse://battles/recent') return { valid: true, type: 'battles' };
    if (uri === 'codepulse://badges/user') return { valid: true, type: 'badges' };
    return { valid: false };
  }
}

describe('Model Context Protocol (MCP) Vitest Suite', () => {
  let validator: McpProtocolValidator;

  beforeEach(() => {
    validator = new McpProtocolValidator();
  });

  describe('API Key Authentication', () => {
    it('approves legitimate cp_mcp_* tokens', () => {
      expect(validator.verifyApiKey('cp_mcp_abc123456789012345678901')).toBe(true);
      expect(validator.verifyApiKey('invalid_token')).toBe(false);
      expect(validator.verifyApiKey(undefined)).toBe(false);
    });
  });

  describe('Sliding-Window Rate Limiting (60 req/min)', () => {
    it('accepts up to 60 calls and sheds 61st call', () => {
      const clientId = 'claude-desktop-session-1';
      for (let i = 0; i < 60; i++) {
        expect(validator.checkRateLimit(clientId)).toBe(true);
      }
      expect(validator.checkRateLimit(clientId)).toBe(false);
    });
  });

  describe('Resource URI Resolution', () => {
    it('resolves valid codepulse:// resource schemas', () => {
      expect(validator.validateResourceUri('codepulse://repositories/repo-42/analytics')).toEqual({
        valid: true,
        type: 'repository',
        id: 'repo-42',
      });
      expect(validator.validateResourceUri('codepulse://battles/recent')).toEqual({
        valid: true,
        type: 'battles',
      });
      expect(validator.validateResourceUri('codepulse://badges/user')).toEqual({
        valid: true,
        type: 'badges',
      });
      expect(validator.validateResourceUri('codepulse://invalid/route')).toEqual({
        valid: false,
      });
    });
  });
});
