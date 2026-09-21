/**
 * veilcred.test.ts
 * ----------------
 * Tests for the credential verification logic in contract.ts.
 * Run with: npm test
 */
import { describe, it, expect, beforeAll, vi } from "vitest";

// ── Mock all Midnight SDK modules before any imports ──────────────────────────

vi.mock('@midnight-ntwrk/midnight-js-contracts', () => ({
  findDeployedContract: vi.fn().mockImplementation(async (_providers: any, _options: any) => {
    return {
      callTx: {
        registerIssuer: vi.fn().mockResolvedValue({
          public: { txHash: '0x' + '11'.repeat(32) }
        }),
        verifyThreshold: vi.fn().mockResolvedValue({
          public: { txHash: '0x' + 'aa'.repeat(32) }
        })
      }
    };
  })
}));

vi.mock('@midnight-ntwrk/midnight-js-protocol/compact-js', () => ({
  CompiledContract: {
    make: vi.fn().mockReturnValue({})
  }
}));

vi.mock('../../managed/veilcred/contract/index.js', () => ({
  Contract: class MockContract {
    constructor(_witnesses: any) {}
  }
}));

// Mock midnightProviders — path must match what contract.ts imports via the 'src' alias
vi.mock('src/utils/midnightProviders', () => ({
  createMidnightProviders: vi.fn().mockResolvedValue({
    privateStateProvider: {
      get: vi.fn().mockResolvedValue({
        issuerKey: new Uint8Array(32).fill(1),
        attributeValue: 24n,
        expiry: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
        signature: new Uint8Array(64),
        holderSecret: new Uint8Array(32).fill(2),
      }),
      set: vi.fn(),
      remove: vi.fn(),
      setContractAddress: vi.fn(),
      getSigningKey: vi.fn().mockResolvedValue(null),
      setSigningKey: vi.fn(),
      removeSigningKey: vi.fn(),
      clearSigningKeys: vi.fn(),
    }
  }),
  getLastSubmittedTxId: vi.fn().mockReturnValue('mockTxHash1122334455667788aabbccdd'),
  resetLastSubmittedTxId: vi.fn(),
}));

import { submitVerification, type CredentialInput } from "../src/utils/contract";

// Fake 1AM wallet API that is injected into window.midnight
const fakeWalletApi = {
  enable: vi.fn().mockResolvedValue({
    state: vi.fn().mockResolvedValue({
      subscribe: (observer: any) => {
        observer.next({ address: "addr_preprod1test_mock_wallet" });
        return { unsubscribe: vi.fn() };
      }
    }),
  }),
  getConfiguration: vi.fn().mockResolvedValue({
    proverServerUri: 'https://api-preprod.1am.xyz',
    indexerUri: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWsUri: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  }),
  getShieldedAddresses: vi.fn().mockResolvedValue({
    shieldedCoinPublicKey: '00'.repeat(32),
    shieldedEncryptionPublicKey: '00'.repeat(32),
  }),
  balanceUnsealedTransaction: vi.fn(),
  submitTransaction: vi.fn().mockResolvedValue('mockSubmitTxHash'),
};

beforeAll(() => {
  // Inject a fake 1AM wallet into the jsdom window object
  (window as any).midnight = {
    mnLace: fakeWalletApi,
  };

  // Polyfill crypto.subtle if not available in the test environment
  if (!(global as any).crypto?.subtle) {
    const nodeCrypto = require('crypto');
    Object.defineProperty(global, 'crypto', {
      value: {
        subtle: {
          digest: async (_algo: string, data: Uint8Array) => {
            return nodeCrypto.createHash('sha256').update(Buffer.from(data)).digest();
          }
        },
        getRandomValues: (arr: Uint8Array) => nodeCrypto.randomFillSync(arr),
      },
      writable: true,
    });
  }
});

const baseInput: CredentialInput = {
  gateLabel: "Age 18+ gate",
  attributeValue: 24,
  threshold: 18,
  expiryTimestamp: Math.floor(Date.now() / 1000) + 86400 * 30,
  issuerKey: "did:midnight:approved-issuer-01",
  holderSecret: "test-secret-0001",
};

const wallet = { address: "addr_preprod1test", network: "preprod" as const };

describe("veilcred credential verification", () => {
  it("verifies successfully when the attribute clears the threshold", async () => {
    const record = await submitVerification(wallet, baseInput);
    expect(record.verified).toBe(true);
    expect(record.gateLabel).toBe("Age 18+ gate");
  });

  it("reports a clean fail when the attribute is below the threshold", async () => {
    const record = await submitVerification(wallet, {
      ...baseInput,
      attributeValue: 16,
    });
    expect(record.verified).toBe(false);
  });

  it("rejects an expired credential before ever checking the threshold", async () => {
    await expect(
      submitVerification(wallet, {
        ...baseInput,
        attributeValue: 99,
        expiryTimestamp: Math.floor(Date.now() / 1000) - 3600,
      })
    ).rejects.toThrow(/expired/i);
  });

  it("rejects a credential with no issuer key", async () => {
    await expect(
      submitVerification(wallet, { ...baseInput, issuerKey: "" })
    ).rejects.toThrow(/issuer/i);
  });

  it("produces a stable nullifier for the same gate + issuer + secret", async () => {
    const a = await submitVerification(wallet, baseInput);
    const b = await submitVerification(wallet, baseInput);
    expect(a.nullifier).toBe(b.nullifier);
  });

  it("produces a different, unlinkable nullifier for a different gate", async () => {
    const a = await submitVerification(wallet, baseInput);
    const b = await submitVerification(wallet, {
      ...baseInput,
      gateLabel: "KYC tier 2 gate",
      threshold: 2,
      attributeValue: 3,
    });
    expect(a.nullifier).not.toBe(b.nullifier);
  });

  it("produces a different nullifier for a different holder secret on the same gate", async () => {
    const a = await submitVerification(wallet, baseInput);
    const b = await submitVerification(wallet, {
      ...baseInput,
      holderSecret: "a-different-secret",
    });
    expect(a.nullifier).not.toBe(b.nullifier);
  });

  it("never includes the raw attribute value in the returned record", async () => {
    const record = await submitVerification(wallet, baseInput);
    // @ts-ignore
    expect(record.attributeValue).toBeUndefined();
  });
});
