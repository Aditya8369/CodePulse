import { buildBattlesPactContract } from './battles-consumer.spec';
import { ContractProviderVerifier } from './provider-verify';

describe('Contract Provider Verification Engine', () => {
  let verifier: ContractProviderVerifier;
  const contract = buildBattlesPactContract();

  beforeEach(() => {
    verifier = new ContractProviderVerifier();
  });

  it('validates a compliant provider successfully', async () => {
    const mockProvider = async (req: any) => {
      const interaction = contract.interactions.find((i) => i.request.path === req.path);
      if (!interaction) {
        return { status: 404, body: {} };
      }
      return {
        status: interaction.response.status,
        headers: interaction.response.headers,
        body: interaction.response.body,
      };
    };

    const result = await verifier.verifyContract(contract, mockProvider);
    expect(result.passed).toBe(true);
    expect(result.verifiedCount).toBe(contract.interactions.length);
    expect(result.failures).toHaveLength(0);
  });

  it('detects breaking changes when a required response property is deleted', async () => {
    const mockProviderWithBreakingChange = async () => {
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: {
          id: 'btl-active-101',
          challengerId: 'usr-challenger-1',
          // opponentId is intentionally omitted
          status: 'COMPLETED',
        },
      };
    };

    const interaction = contract.interactions[0];
    const errors = verifier.verifyResponse(
      interaction,
      200,
      {
        id: 'btl-active-101',
        challengerId: 'usr-challenger-1',
        // opponentId missing
        status: 'COMPLETED',
        category: 'ALGORITHMS',
        challengerScore: 98.5,
        opponentScore: 84.0,
        winnerId: 'usr-challenger-1',
      },
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('[BREAKING_CHANGE: MISSING_FIELD] Field "opponentId"');
  });

  it('detects type regressions (e.g. number changed to string)', async () => {
    const interaction = contract.interactions[0];
    const errors = verifier.verifyResponse(
      interaction,
      200,
      {
        id: 'btl-active-101',
        challengerId: 'usr-challenger-1',
        opponentId: 'usr-opponent-2',
        status: 'COMPLETED',
        category: 'ALGORITHMS',
        challengerScore: '98.5', // Type regression: string instead of number
        opponentScore: 84.0,
        winnerId: 'usr-challenger-1',
      },
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('[BREAKING_CHANGE: TYPE_MISMATCH] Field "challengerScore"');
  });

  it('detects HTTP status code mismatch', async () => {
    const interaction = contract.interactions[0];
    const errors = verifier.verifyResponse(
      interaction,
      500,
      { error: 'Internal Error' },
    );

    expect(errors.some((e) => e.includes('[STATUS_CODE_MISMATCH]'))).toBe(true);
  });
});
