import * as fs from 'fs';
import * as path from 'path';
import { PactContract, PactInteraction } from './contracts.types';

export function buildBattlesPactContract(): PactContract {
  const interactions: PactInteraction[] = [
    {
      description: 'a request to get active battle details by ID',
      providerState: 'battle btl-active-101 exists in COMPLETED state',
      request: {
        method: 'GET',
        path: '/api/battles/btl-active-101',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer mock-jwt-token',
        },
      },
      response: {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          id: 'btl-active-101',
          challengerId: 'usr-challenger-1',
          opponentId: 'usr-opponent-2',
          status: 'COMPLETED',
          category: 'ALGORITHMS',
          challengerScore: 98.5,
          opponentScore: 84.0,
          winnerId: 'usr-challenger-1',
        },
      },
    },
    {
      description: 'a request to initialize a new battle matchmaking lobby',
      providerState: 'user usr-challenger-1 is authorized and has sufficient tickets',
      request: {
        method: 'POST',
        path: '/api/battles',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-jwt-token',
        },
        body: {
          challengerId: 'usr-challenger-1',
          category: 'ALGORITHMS',
          difficulty: 'MEDIUM',
        },
      },
      response: {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          id: 'btl-newly-created-55',
          challengerId: 'usr-challenger-1',
          status: 'WAITING_FOR_OPPONENT',
          category: 'ALGORITHMS',
          createdAt: '2026-11-23T00:00:00.000Z',
        },
      },
    },
    {
      description: 'a request to submit code solution for an active match',
      providerState: 'battle btl-active-101 is in progress',
      request: {
        method: 'POST',
        path: '/api/battles/btl-active-101/submit',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-jwt-token',
        },
        body: {
          code: 'function solve() { return 42; }',
          language: 'typescript',
        },
      },
      response: {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          battleId: 'btl-active-101',
          passed: true,
          executionTimeMs: 42,
          score: 100,
        },
      },
    },
    {
      description: 'a request to fetch developer public profile',
      providerState: 'user dev_alex exists',
      request: {
        method: 'GET',
        path: '/api/users/profile/dev_alex',
        headers: {
          Accept: 'application/json',
        },
      },
      response: {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          id: 'usr-alex-1',
          username: 'dev_alex',
          email: 'alex@codepulse.dev',
          isOnline: true,
          rating: 1850,
        },
      },
    },
  ];

  return {
    consumer: { name: 'CodePulseFrontend' },
    provider: { name: 'CodePulseBattlesAPI' },
    interactions,
    metadata: {
      pactSpecification: { version: '2.0.0' },
      createdAt: new Date().toISOString(),
    },
  };
}

export function writePactFile(outputPath?: string): string {
  const contract = buildBattlesPactContract();
  const dir = outputPath ? path.dirname(outputPath) : path.join(__dirname, 'pacts');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const target = outputPath || path.join(dir, 'codepulsefrontend-codepulsebattlesapi.json');
  fs.writeFileSync(target, JSON.stringify(contract, null, 2), 'utf-8');
  return target;
}

describe('Consumer Contract Test Suite (Pact Specification)', () => {
  it('generates valid Pact contract definitions for Battles and Profiles', () => {
    const contract = buildBattlesPactContract();
    expect(contract.consumer.name).toBe('CodePulseFrontend');
    expect(contract.provider.name).toBe('CodePulseBattlesAPI');
    expect(contract.interactions.length).toBeGreaterThanOrEqual(4);

    for (const interaction of contract.interactions) {
      expect(interaction.request.path).toMatch(/^\/api\//);
      expect(interaction.response.status).toBeGreaterThanOrEqual(200);
      expect(interaction.response.body).toBeDefined();
    }
  });

  it('serializes contract JSON to disk with standard pact format', () => {
    const filePath = writePactFile();
    expect(fs.existsSync(filePath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PactContract;
    expect(content.consumer.name).toBe('CodePulseFrontend');
  });
});
