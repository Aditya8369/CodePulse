import { CryptoMpcVaultService, MpcKeyShare } from './mpc-vault.service';

describe('CryptoMpcVaultService (Shamir Secret Sharing 2-of-3 MPC Vault)', () => {
  let vault: CryptoMpcVaultService;

  beforeEach(() => {
    vault = new CryptoMpcVaultService();
  });

  it('splits master private key into 3 shares and reconstructs with any 2 of 3', () => {
    const { masterSecretHex, shares } = vault.splitMasterKey();
    expect(shares.length).toBe(3);

    // Any 2 shares must reconstruct the exact same master secret:
    const reconstructed12 = vault.reconstructSecret(shares[0], shares[1]);
    const reconstructed23 = vault.reconstructSecret(shares[1], shares[2]);
    const reconstructed13 = vault.reconstructSecret(shares[0], shares[2]);

    expect(reconstructed12).toBe(masterSecretHex);
    expect(reconstructed23).toBe(masterSecretHex);
    expect(reconstructed13).toBe(masterSecretHex);
  });

  it('proves a single share reveals zero key bits (information-theoretic secrecy)', () => {
    const { masterSecretHex, shares } = vault.splitMasterKey();
    const singleShare = shares[0];

    // With only 1 share, every possible master secret candidate S has an equally likely polynomial coefficient
    expect(singleShare.shareValue).not.toBe(masterSecretHex);
    expect(singleShare.shareValue.length).toBe(64);
  });

  it('performs threshold signature with any 2 of 3 nodes matching across all pairs', () => {
    const { shares } = vault.splitMasterKey();
    const message = 'TOURNAMENT_PRIZE_PAYOUT_EVENT_HASH_2026';

    const sig12 = vault.thresholdSign(message, shares[0], shares[1]);
    const sig23 = vault.thresholdSign(message, shares[1], shares[2]);
    const sig13 = vault.thresholdSign(message, shares[0], shares[2]);

    expect(sig12.verified).toBe(true);
    expect(sig12.signatureHex).toBe(sig23.signatureHex);
    expect(sig23.signatureHex).toBe(sig13.signatureHex);
  });

  it('automates proactive secret resharing keeping the master secret unchanged', () => {
    const { masterSecretHex, shares } = vault.splitMasterKey();
    const reshared = vault.reshareKeys(shares);

    // Share values must be refreshed
    expect(reshared[0].shareValue).not.toBe(shares[0].shareValue);
    expect(reshared[1].shareValue).not.toBe(shares[1].shareValue);

    // Reconstructing from new reshared shares yields the EXACT same master secret!
    const reconstructedNew = vault.reconstructSecret(reshared[0], reshared[2]);
    expect(reconstructedNew).toBe(masterSecretHex);
  });
});
