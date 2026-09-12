/**
 * contract.ts
 * -----------
 * Thin wrapper around the Midnight wallet connector and the generated
 * contract client for `contracts/veilcred.compact`.
 *
 * Everything in this file that talks to real infrastructure is marked
 * with TODO(midnight-sdk). Until those are wired up, this module runs
 * a local, honest simulation of the same flow (hashing, nullifier
 * derivation, expiry/threshold checks) so the UI is fully testable
 * before wallet + Preprod wiring is finished.
 *
 * To go live:
 *   1. `compact compile contracts/veilcred.compact managed/veilcred`
 *   2. `npm install @midnight-ntwrk/dapp-connector-api @midnight-ntwrk/midnight-js-contracts`
 *   3. Replace the TODO(midnight-sdk) blocks below with real calls
 *      against the generated `managed/veilcred` contract client.
 */

export interface WalletState {
  address: string;
  network: "preview" | "preprod" | "mainnet";
}

export interface CredentialInput {
  gateLabel: string; // e.g. "Age 18+ gate" — hashed into gateId, never stored raw
  attributeValue: number; // private: e.g. birth year converted to age, or tier
  threshold: number; // public: minimum required value
  expiryTimestamp: number; // private: unix seconds
  issuerKey: string; // private: which approved issuer signed this
  holderSecret: string; // private: user-held secret for nullifier derivation
}

export interface VerificationRecord {
  nullifier: string;
  gateLabel: string;
  verified: boolean;
  timestamp: number;
}

// ---------------------------------------------------------------------
// Wallet connection
// ---------------------------------------------------------------------
export async function connectWallet(): Promise<WalletState> {
  // TODO(midnight-sdk): replace with real Lace/Midnight wallet connector, e.g.
  //   const api = await window.midnight?.mnLace?.enable();
  //   const state = await api.state();
  //   return { address: state.address, network: "preprod" };
  await delay(500);
  const mockAddress = "addr_preprod1" + randomHex(20);
  return { address: mockAddress, network: "preprod" };
}

export async function disconnectWallet(): Promise<void> {
  await delay(150);
}

// ---------------------------------------------------------------------
// Contract call: verifyThreshold
// ---------------------------------------------------------------------
export async function submitVerification(
  _wallet: WalletState,
  input: CredentialInput
): Promise<VerificationRecord> {
  // TODO(midnight-sdk): replace this whole body with a call into the
  // generated contract client, e.g.:
  //
  //   const gateId = toHex(sha256(input.gateLabel));
  //   const tx = await contract.callTx.verifyThreshold(
  //     gateId,
  //     BigInt(input.threshold),
  //     BigInt(Math.floor(Date.now() / 1000)),
  //     { privateState: { issuerKey, attributeValue, expiry, signature, holderSecret } }
  //   );
  //   return { nullifier: tx.public.nullifier, verified: tx.public.passes, ... };
  //
  // The block below mirrors the *exact same checks the circuit performs*
  // so the UI behaves identically pre- and post- SDK wiring.

  await delay(900); // simulated proof generation time

  const now = Math.floor(Date.now() / 1000);

  if (input.expiryTimestamp <= now) {
    throw new Error("Credential has expired — cannot generate a valid proof");
  }
  if (!input.issuerKey || input.issuerKey.trim().length === 0) {
    throw new Error("No issuer key supplied — is this credential signed?");
  }

  const verified = input.attributeValue >= input.threshold;

  const nullifier = await sha256Hex(
    `${input.gateLabel}:${input.issuerKey}:${input.holderSecret}`
  );

  return {
    nullifier,
    gateLabel: input.gateLabel,
    verified,
    timestamp: now,
  };
}

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}
