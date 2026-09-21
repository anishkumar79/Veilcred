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

// Static imports — required for vi.mock() to intercept them in tests
import { createMidnightProviders, getLastSubmittedTxId, resetLastSubmittedTxId } from "./midnightProviders.js";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { Contract } from "../../managed/veilcred/contract/index.js";

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
  txHash?: string;
  explorerUrl?: string;
}

// ---------------------------------------------------------------------
// Wallet connection
// ---------------------------------------------------------------------
let cachedWalletApi: any = null;

export function getActiveWalletProvider() {
  const midnightObj = (window as any).midnight;
  if (!midnightObj) return null;
  return (
    midnightObj.mnLace ||
    midnightObj.lace ||
    midnightObj["1am"] ||
    midnightObj.oneam ||
    midnightObj["1AM"] ||
    Object.values(midnightObj)[0]
  );
}

export async function connectWallet(): Promise<WalletState> {
  const walletProvider = getActiveWalletProvider();
  if (!walletProvider) {
    throw new Error("No Midnight wallet found. Please install a compatible wallet.");
  }
  
  // Connect to trigger the popup
  const api = await (walletProvider.connect ? walletProvider.connect("preprod") : (walletProvider as any).enable());
  cachedWalletApi = api;
  
  return { address: "connected-wallet-hidden", network: "preprod" };
}

export async function disconnectWallet(): Promise<void> {
  cachedWalletApi = null;
  localStorage.removeItem("veilcred_wallet");
}

export const VERIFIED_PREPROD_CONTRACT_ADDRESS = "5c05efc1a9fcd0a0ea1f498d8622c3bf67e99ea5983345fbc1a10440817e2127";
export const VERIFIED_PREPROD_EXPLORER_URL = `https://preprod.midnightexplorer.com/contracts/0x${VERIFIED_PREPROD_CONTRACT_ADDRESS}`;

export async function getDeployedContractInfo(): Promise<{ contractAddress: string; explorerUrl: string } | null> {
  try {
    const res = await fetch("/deployed_contract.json");
    if (res.ok) {
      const data = await res.json();
      if (data && data.contractAddress) {
        return {
          contractAddress: data.contractAddress,
          explorerUrl: data.explorerUrl || `https://preprod.midnightexplorer.com/contracts/0x${data.contractAddress}`,
        };
      }
    }
  } catch {}
  return {
    contractAddress: VERIFIED_PREPROD_CONTRACT_ADDRESS,
    explorerUrl: VERIFIED_PREPROD_EXPLORER_URL,
  };
}

import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";

export async function deployVeilcredContractReal(providers: any): Promise<string> {
  console.log("Deploying contract from browser using 1AM Wallet...");
  try {
    const witnesses = {
      // The contract's deploy function requires witnesses but they can be empty for this contract
    };
    const contractWithWitnesses = CompiledContract.withWitnesses(witnesses as any)(Contract as any);
    const deployed = await deployContract(providers, {
      compiledContract: contractWithWitnesses as any,
      args: []
    });
    
    const deployedAddress = deployed.deployTxData.public.contractAddress;
    console.log("Deployed on-chain at:", deployedAddress);
    alert(`Deployed successfully! New contract address is: ${deployedAddress}\n\nPlease copy this and update deployed_contract.json`);
    return deployedAddress;
  } catch (e: any) {
    console.error("Browser deployment failed:", e);
    alert(`Deployment failed: ${e.message}`);
    throw e;
  }
}

// ---------------------------------------------------------------------
// Contract Deployment (via 1AM Wallet browser extension)
// ---------------------------------------------------------------------
export async function deployVeilcredContract(): Promise<string> {
  try {
    const midnightObj = (window as any).midnight || {};
    const mnLace = midnightObj.mnLace || midnightObj.lace || Object.values(midnightObj)[0];
    
    if (mnLace) {
      const api = await (mnLace.connect ? mnLace.connect("preprod") : (mnLace as any).enable());
      const providers = await createMidnightProviders(api);
      return await deployVeilcredContractReal(providers as any);
    } else {
      throw new Error("No Midnight wallet found in browser. Please install 1AM Wallet.");
    }
  } catch (e: any) {
    console.error("Browser deployment failed", e);
    alert("Deployment failed: " + e.message);
    throw e;
  }
}

// ---------------------------------------------------------------------
// Contract call: verifyThreshold
// ---------------------------------------------------------------------
export async function submitVerification(
  _wallet: WalletState,
  input: CredentialInput
): Promise<VerificationRecord> {
  const now = Math.floor(Date.now() / 1000);
  if (input.expiryTimestamp <= now) {
    throw new Error("Credential has expired — cannot generate a valid proof");
  }
  if (!input.issuerKey || input.issuerKey.trim().length === 0) {
    throw new Error("No issuer key supplied — is this credential signed?");
  }

  let api = cachedWalletApi;
  if (!api) {
    const walletProvider = getActiveWalletProvider();
    if (!walletProvider) throw new Error("1AM wallet extension not found. Please install and unlock 1AM wallet.");
    api = await (walletProvider.connect ? walletProvider.connect("preprod") : (walletProvider as any).enable());
    cachedWalletApi = api;
  }
  
  try {
    resetLastSubmittedTxId();
    
    // Convert witnesses into proper 32-byte arrays for Compact runtime
    const issuerBytes = await sha256Bytes(input.issuerKey);
    const secretStr = input.holderSecret || randomHex(16);
    const secretBytes = await sha256Bytes(secretStr);

    const providers = await createMidnightProviders(api, issuerBytes);

    // Inject the private state for this specific proof verification
    providers.privateStateProvider.get = async () => ({
        issuerKey: issuerBytes,
        attributeValue: BigInt(input.attributeValue),
        expiry: BigInt(input.expiryTimestamp),
        signature: new Uint8Array(64), // Mocked signature format for hackathon
        holderSecret: secretBytes 
    });

    // Initialize the generated contract wrapper with the required witnesses
    class VeilcredContractWrapper extends (Contract as any) {
      constructor() {
        super({
          issuerKey: (ctx: any) => [ctx.privateState, ctx.privateState.issuerKey],
          attributeValue: (ctx: any) => [ctx.privateState, ctx.privateState.attributeValue],
          expiry: (ctx: any) => [ctx.privateState, ctx.privateState.expiry],
          signature: (ctx: any) => [ctx.privateState, ctx.privateState.signature],
          holderSecret: (ctx: any) => [ctx.privateState, ctx.privateState.holderSecret],
        });
      }
    }

    const compiledContract = (CompiledContract as any).make(
      "veilcred",
      VeilcredContractWrapper as any
    ) as any;
    
    const deployed = await getDeployedContractInfo();
    const address = deployed?.contractAddress || VERIFIED_PREPROD_CONTRACT_ADDRESS;
    
    const client = await findDeployedContract(providers as any, {
      contractAddress: address,
      compiledContract,
      privateStateId: 'veilcred-private-state',
      initialPrivateState: await providers.privateStateProvider.get('veilcred-private-state')
    });
    
    // Execute the contract circuit — prompts 1AM wallet approval popup
    const data = new TextEncoder().encode(input.gateLabel);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const gateIdBytes = new Uint8Array(digest);
    
    console.log("Step 1: Registering issuer on-chain...");
    let tx: any;
    
    // Step 1: Register the issuer (if not already registered)
    try {
      resetLastSubmittedTxId();
      tx = await Promise.race([
        (client.callTx as any).registerIssuer(issuerBytes),
        new Promise((_, reject) => setTimeout(() => reject(new Error("registerIssuer timeout")), 90000))
      ]);
      console.log("registerIssuer tx submitted:", tx);
      // Wait for indexer to pick up the registerIssuer tx (skip in fast mock environments)
      const waitMs = typeof (global as any).vi !== 'undefined' ? 0 : 5000;
      if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));
    } catch (regErr: any) {
      const regMsg = String(regErr?.message || regErr || "");
      // If already registered or submission dup error, that's fine — proceed
      if (regMsg.includes("already") || regMsg.includes("duplicate") || regMsg.includes("SubmissionError")) {
        console.warn("registerIssuer failed (possibly already registered), proceeding to verifyThreshold:", regMsg);
      } else {
        console.error("registerIssuer failed with unexpected error:", regMsg);
        throw new Error(`Failed to register issuer: ${regMsg}`);
      }
    }

    // Step 2: Verify threshold (the main proof)
    console.log("Step 2: Running verifyThreshold proof...");
    resetLastSubmittedTxId();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("On-chain verification timed out waiting for wallet/network.")), 90000)
    );
    tx = await Promise.race([
      (client.callTx as any).verifyThreshold(
        gateIdBytes,
        BigInt(input.threshold),
        BigInt(now)
      ),
      timeoutPromise
    ]);
    console.log("verifyThreshold tx succeeded:", tx);
    
    // Extract real transaction hash from on-chain submission
    const submittedId = getLastSubmittedTxId();
    const rawTxHash = submittedId || tx?.public?.txHash || tx?.public?.txId || tx?.txHash || tx;
    const cleanTxHash = String(rawTxHash || "").replace(/^0x/, "");
    const passes = input.attributeValue >= input.threshold;
    
    const derivedNullifier = await sha256Hex(`${input.gateLabel}:${input.issuerKey}:${secretStr}`);
    
    return {
      nullifier: derivedNullifier,
      gateLabel: input.gateLabel,
      verified: passes,
      timestamp: now,
      txHash: "0x" + cleanTxHash,
      explorerUrl: `https://explorer.1am.xyz/tx/${cleanTxHash}?network=preprod`
    };

  } catch (err: any) {
    console.error("1AM transaction execution error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("background script") || msg.includes("extension loaded")) {
      throw new Error("1AM Wallet background script is unresponsive. Please reload this page (Ctrl + F5) or click your 1AM extension icon to wake it up.");
    }
    if (msg.includes("User reject") || msg.includes("declined") || msg.includes("cancelled") || msg.includes("Canceled")) {
      throw new Error("Transaction signature was cancelled in 1AM wallet.");
    }
    if (msg.includes("timed out")) {
      throw new Error("Transaction timed out waiting for 1AM wallet approval.");
    }
    throw new Error(msg || "Could not execute transaction in 1AM wallet.");
  }
}

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------
async function sha256Hex(msg: string): Promise<string> {
  const data = new TextEncoder().encode(msg);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

async function sha256Bytes(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest);
}
