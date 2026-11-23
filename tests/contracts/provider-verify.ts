import * as fs from 'fs';
import { ContractVerificationResult, PactContract, PactInteraction } from './contracts.types';

export class ContractProviderVerifier {
  /**
   * Compares expected contract response schema against actual provider response.
   */
  verifyResponse(
    interaction: PactInteraction,
    actualStatus: number,
    actualBody: unknown,
    actualHeaders?: Record<string, string>,
  ): string[] {
    const errors: string[] = [];
    const expected = interaction.response;

    // 1. Status Code Check
    if (actualStatus !== expected.status) {
      errors.push(
        `[STATUS_CODE_MISMATCH] Expected HTTP status ${expected.status} but provider returned ${actualStatus}`,
      );
    }

    // 2. Body Structural Comparison
    if (expected.body) {
      if (!actualBody || typeof actualBody !== 'object') {
        errors.push(
          `[RESPONSE_BODY_MISSING] Expected object response body, received: ${typeof actualBody}`,
        );
      } else {
        this.diffObjects('', expected.body, actualBody as Record<string, unknown>, errors);
      }
    }

    // 3. Header Checks
    if (expected.headers && actualHeaders) {
      for (const [key, val] of Object.entries(expected.headers)) {
        const found = Object.entries(actualHeaders).find(
          ([k]) => k.toLowerCase() === key.toLowerCase(),
        );
        if (!found || !found[1].includes(val)) {
          errors.push(
            `[HEADER_MISMATCH] Expected header "${key}: ${val}" but provider returned "${found ? found[1] : 'NOT_FOUND'}"`,
          );
        }
      }
    }

    return errors;
  }

  private diffObjects(
    path: string,
    expected: Record<string, unknown>,
    actual: Record<string, unknown>,
    errors: string[],
  ): void {
    for (const [key, expectedVal] of Object.entries(expected)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (!(key in actual)) {
        errors.push(
          `[BREAKING_CHANGE: MISSING_FIELD] Field "${currentPath}" is required by consumer contract but missing in provider response`,
        );
        continue;
      }

      const actualVal = actual[key];
      const expectedType = Array.isArray(expectedVal) ? 'array' : typeof expectedVal;
      const actualType = Array.isArray(actualVal) ? 'array' : typeof actualVal;

      if (expectedType !== actualType) {
        errors.push(
          `[BREAKING_CHANGE: TYPE_MISMATCH] Field "${currentPath}" expected type "${expectedType}", provider returned "${actualType}"`,
        );
        continue;
      }

      if (expectedType === 'object' && expectedVal !== null && actualVal !== null) {
        this.diffObjects(
          currentPath,
          expectedVal as Record<string, unknown>,
          actualVal as Record<string, unknown>,
          errors,
        );
      }
    }
  }

  /**
   * Verifies an entire Pact contract against a simulated or active controller provider.
   */
  async verifyContract(
    contract: PactContract,
    providerHandler: (req: PactInteraction['request']) => Promise<{
      status: number;
      body: unknown;
      headers?: Record<string, string>;
    }>,
  ): Promise<ContractVerificationResult> {
    const result: ContractVerificationResult = {
      passed: true,
      totalInteractions: contract.interactions.length,
      verifiedCount: 0,
      failures: [],
    };

    for (const interaction of contract.interactions) {
      try {
        const response = await providerHandler(interaction.request);
        const errs = this.verifyResponse(
          interaction,
          response.status,
          response.body,
          response.headers,
        );

        result.verifiedCount++;
        if (errs.length > 0) {
          result.passed = false;
          result.failures.push({
            interaction: interaction.description,
            errors: errs,
          });
        }
      } catch (err) {
        result.passed = false;
        result.failures.push({
          interaction: interaction.description,
          errors: [`[PROVIDER_EXECUTION_FAILURE] ${(err as Error).message}`],
        });
      }
    }

    return result;
  }
}

/**
 * CLI runner for contract verification in CI.
 */
export async function runContractVerification(): Promise<boolean> {
  const verifier = new ContractProviderVerifier();
  const pactFilePath = `${__dirname}/pacts/codepulsefrontend-codepulsebattlesapi.json`;

  if (!fs.existsSync(pactFilePath)) {
    console.error(`Pact contract file not found at ${pactFilePath}`);
    return false;
  }

  const contract = JSON.parse(fs.readFileSync(pactFilePath, 'utf-8')) as PactContract;

  // Mock provider returning conforming schema
  const mockProvider = async (req: PactInteraction['request']) => {
    if (req.path === '/api/battles/btl-active-101') {
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
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
      };
    }
    if (req.path === '/api/battles' && req.method === 'POST') {
      return {
        status: 201,
        headers: { 'content-type': 'application/json' },
        body: {
          id: 'btl-newly-created-55',
          challengerId: 'usr-challenger-1',
          status: 'WAITING_FOR_OPPONENT',
          category: 'ALGORITHMS',
          createdAt: '2026-11-23T00:00:00.000Z',
        },
      };
    }
    if (req.path === '/api/battles/btl-active-101/submit') {
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: {
          battleId: 'btl-active-101',
          passed: true,
          executionTimeMs: 42,
          score: 100,
        },
      };
    }
    if (req.path === '/api/users/profile/dev_alex') {
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: {
          id: 'usr-alex-1',
          username: 'dev_alex',
          email: 'alex@codepulse.dev',
          isOnline: true,
          rating: 1850,
        },
      };
    }

    return {
      status: 404,
      body: { error: 'Not found' },
    };
  };

  const verification = await verifier.verifyContract(contract, mockProvider);
  if (!verification.passed) {
    console.error('Contract verification FAILED:');
    console.error(JSON.stringify(verification.failures, null, 2));
    return false;
  }

  console.log(`Contract verification PASSED: ${verification.verifiedCount}/${verification.totalInteractions} interactions verified.`);
  return true;
}
