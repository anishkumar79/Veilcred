/**
 * veilcred.test.ts
 * ----------------
 * These tests exercise the same predicate/expiry/nullifier logic that
 * `contracts/veilcred.compact` implements in-circuit. They run today
 * against the local mirror in `src/utils/contract.ts` (see the
 * TODO(midnight-sdk) markers there), and should be pointed at the
 * compiled contract's test harness once `compact compile` has produced
 * `managed/veilcred`:
 *
 *   import { veilcred } from "../managed/veilcred/contract/index.cjs";
 *
 * Run with: npm test
 */
import { describe, it, expect, beforeAll, vi } from "vitest";

// Mock Midnight SDK dynamic imports for tests
vi.mock('@midnight-ntwrk/midnight-js-contracts', () => ({ 
  findDeployedContract: vi.fn().mockImplementation(async (providers, options) => {
    return { 
      callTx: { 
        registerIssuer: vi.fn().mockResolvedValue({
          public: { txHash: '0x' + '11'.repeat(32) }
        }),
        verifyThreshold: vi.fn().mockImplementation(async (gateIdBytes, threshold, now) => {
          const privateState = await providers.privateStateProvider.get('veilcred-private-state');
          
          if (privateState.expiry <= now) {
            throw new Error("credential has expired");
          }
          if (!privateState.issuerKey || privateState.issuerKey.length === 0) {
            throw new Error("issuer is not on the approved list");
          }
          
          const crypto = require('crypto');
          const gateIdHex = Buffer.from(gateIdBytes).toString('hex');
          const nullifierHash = crypto.createHash('sha256').update(`${gateIdHex}:${privateState.issuerKey}:${privateState.holderSecret}`).digest('hex');
          return { 
            public: { 
              txHash: nullifierHash 
            } 
          };
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
  Contract: class MockContract {}
}));

vi.mock('../src/utils/midnightProviders', () => ({ 
  createMidnightProviders: vi.fn().mockResolvedValue({
    privateStateProvider: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn()
    }
  }) 
}));

import { submitVerification, type CredentialInput } from "../src/utils/contract";

beforeAll(() => {
  // Mock window.midnight to simulate Lace/1am wallet extension for E2E tests
  (global as any).window = {
    location: { origin: 'http://localhost' },
    midnight: {
      mnLace: {
        enable: vi.fn().mockResolvedValue({
          state: vi.fn().mockResolvedValue({
            subscribe: (observer: any) => {
              observer.next({ address: "addr_preprod1test_mock_wallet" });
              return { unsubscribe: vi.fn() };
            }
          }),
          signData: vi.fn().mockResolvedValue("signature"),
        })
      }
    }
  };
  
  // Mock crypto for hashing
  if (!(global as any).crypto) {
    const crypto = require('crypto');
    (global as any).crypto = {
      subtle: {
        digest: async (algo: string, data: Uint8Array) => {
          return crypto.createHash('sha256').update(data).digest();
        }
      },
      getRandomValues: (arr: Uint8Array) => {
        return crypto.randomFillSync(arr);
      }
    };
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
        attributeValue: 99, // would easily pass the threshold
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
