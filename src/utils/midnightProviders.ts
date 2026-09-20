import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { fromHex, toHex } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import {
  Binding,
  Proof,
  SignatureEnabled,
  Transaction,
} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import type { FinalizedTransaction, TransactionId } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import type { UnboundTransaction } from "@midnight-ntwrk/midnight-js-types";
import { createWalletProvider } from "@midnight-ntwrk/midnight-js-types";
import { blake2b } from "@noble/hashes/blake2.js";

// The DApp connector v4 Wallet API interface that implements shielded operations
export interface WalletConnectorAPI {
  getConfiguration(): Promise<{ proverServerUri?: string; indexerUri: string; indexerWsUri: string }>;
  getShieldedAddresses(): Promise<{ shieldedCoinPublicKey: string; shieldedEncryptionPublicKey: string }>;
  balanceUnsealedTransaction(tx: string): Promise<{ tx: string }>;
  submitTransaction(tx: string): Promise<void>;
}

export let lastSubmittedTxId: string | null = null;
export function getLastSubmittedTxId(): string | null {
  return lastSubmittedTxId;
}
export function resetLastSubmittedTxId(): void {
  lastSubmittedTxId = null;
}

export async function createMidnightProviders(api: WalletConnectorAPI) {
  // Fetch ZK proof keys and Intermediate Representation (ZKIR) from the public folder
  const zkConfigPath = window.location.origin;
  
  const keyMaterialProvider = new FetchZkConfigProvider<any>(zkConfigPath, { fetchFunc: fetch.bind(window) });
  
  let proverUri = "https://api-preprod.1am.xyz";
  let indexerUri = "https://indexer.preprod.midnight.network/api/v4/graphql";
  let indexerWsUri = "wss://indexer.preprod.midnight.network/api/v4/graphql/ws";
  
  try {
    const config = await api.getConfiguration();
    if (config?.proverServerUri) proverUri = config.proverServerUri;
    if (config?.indexerUri) indexerUri = config.indexerUri;
    if (config?.indexerWsUri) indexerWsUri = config.indexerWsUri;
  } catch (e) {
    console.warn("Could not read wallet getConfiguration, using 1AM ProofStation defaults:", e);
  }
  
  let shieldedCoinPk = "0000000000000000000000000000000000000000000000000000000000000000";
  let shieldedEncPk = "0000000000000000000000000000000000000000000000000000000000000000";
  try {
    const addresses = await api.getShieldedAddresses();
    if (addresses?.shieldedCoinPublicKey) shieldedCoinPk = addresses.shieldedCoinPublicKey;
    if (addresses?.shieldedEncryptionPublicKey) shieldedEncPk = addresses.shieldedEncryptionPublicKey;
  } catch (e) {
    console.warn("Could not read shielded addresses:", e);
  }

  const providers = {
    privateStateProvider: {
        get: async () => ({}),
        set: async () => {},
        remove: async () => {},
        setContractAddress: async () => {},
        getSigningKey: async () => null,
        setSigningKey: async () => {},
        removeSigningKey: async () => {},
        clearSigningKeys: async () => {}
    } as any,
    zkConfigProvider: keyMaterialProvider,
    proofProvider: httpClientProofProvider(proverUri, keyMaterialProvider),
    publicDataProvider: (() => {
      const base: any = indexerPublicDataProvider(indexerUri, indexerWsUri);
      
      const vkCache = new Map<string, Uint8Array>();
      ["registerIssuer", "verifyThreshold", "isVerified"].forEach(async (id) => {
        try {
          const res = await fetch(`/keys/${id}.verifier`);
          if (res.ok) {
            const buf = await res.arrayBuffer();
            vkCache.set(id, new Uint8Array(buf));
          }
        } catch {}
      });

      const wrapState = (state: any) => {
        if (!state || typeof state !== "object") return state;
        const origOp = typeof state.operation === "function" ? state.operation.bind(state) : null;

        return new Proxy(state, {
          get(target, prop, receiver) {
            if (prop === "version") return "v9";
            if (prop === "operation") {
              return (circuitId: string) => {
                const existing = origOp ? origOp(circuitId) : null;
                const cachedVk = vkCache.get(circuitId);
                if (cachedVk) {
                  return {
                    ...(existing || {}),
                    verifierKey: cachedVk,
                  };
                }
                return existing;
              };
            }
            const val = Reflect.get(target, prop, receiver);
            return typeof val === "function" ? val.bind(target) : val;
          },
        });
      };

      const origWatchDeploy = base.watchForDeployTxData?.bind(base);
      if (origWatchDeploy) {
        base.watchForDeployTxData = async (addr: string) => {
          const data = await origWatchDeploy(addr);
          return wrapState(data);
        };
      }
      const origWatchTx = base.watchForTxData?.bind(base);
      if (origWatchTx) {
        base.watchForTxData = async (txId: string) => {
          const data = await origWatchTx(txId);
          return wrapState(data);
        };
      }
      const origQueryDeploy = base.queryDeployContractState?.bind(base);
      if (origQueryDeploy) {
        base.queryDeployContractState = async (addr: string) => {
          const data = await origQueryDeploy(addr);
          return wrapState(data);
        };
      }
      const origQueryContract = base.queryContractState?.bind(base);
      if (origQueryContract) {
        base.queryContractState = async (addr: string, config?: any) => {
          const data = await origQueryContract(addr, config);
          return wrapState(data);
        };
      }
      const origQueryZswap = base.queryZSwapAndContractState?.bind(base);
      if (origQueryZswap) {
        base.queryZSwapAndContractState = async (addr: string, config?: any) => {
          const data = await origQueryZswap(addr, config);
          if (Array.isArray(data) && data[1]) {
            data[1] = wrapState(data[1]);
          }
          return data;
        };
      }
      const origQueryRaw = base.queryRawContractState?.bind(base);
      if (origQueryRaw) {
        base.queryRawContractState = async (addr: string, config?: any) => {
          const data = await origQueryRaw(addr, config);
          return wrapState(data);
        };
      }
      return base;
    })(),
    walletProvider: createWalletProvider({
      getCoinPublicKey: () => shieldedCoinPk,
      getEncryptionPublicKey: () => shieldedEncPk,
      balanceTx: async (tx: UnboundTransaction): Promise<FinalizedTransaction> => {
        const serializedTx = toHex(tx.serialize());
        if (typeof api.balanceUnsealedTransaction === "function") {
          try {
            console.log("Balancing transaction with 1AM wallet...");
            const received = await api.balanceUnsealedTransaction(serializedTx);
            return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
              "signature",
              "proof",
              "binding",
              fromHex(received.tx),
            );
          } catch (walletBalErr) {
            console.warn("Wallet balanceUnsealedTransaction failed, falling back to 1AM ProofStation fee sponsor:", walletBalErr);
          }
        }
        
        // Fee sponsorship via 1AM ProofStation
        console.log("Sponsoring fees via 1AM ProofStation /balance-only...");
        const txBytes = tx.serialize();
        const balanceResp = await fetch("https://api-preprod.1am.xyz/balance-only", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: txBytes as unknown as BodyInit,
        });
        if (balanceResp.ok) {
          const { txBytes: balancedHex } = (await balanceResp.json()) as { txBytes: string };
          console.log("ProofStation fee sponsorship succeeded!");
          return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
            "signature",
            "proof",
            "binding",
            fromHex(balancedHex),
          );
        }
        throw new Error("Could not balance transaction: 1AM wallet has 0 Shielded Holdings and ProofStation fee sponsorship failed.");
      },
    }),
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        const txBytes = tx.serialize();
        const txHex = toHex(txBytes);
        const computedExtrinsicHash = toHex(blake2b(txBytes, { dkLen: 32 }));
        console.log("Submitting transaction to 1AM wallet for approval popup, length:", txHex.length, "extrinsicHash:", computedExtrinsicHash);
        
        const midnightObj = (window as any).midnight || {};
        const oneAm = midnightObj["1am"] || midnightObj.oneam || midnightObj["1AM"] || (api as any);
        const targetApi = typeof (api as any)?.submitTransaction === "function" ? api : (typeof oneAm?.submitTransaction === "function" ? oneAm : api);

        let res: any;
        if (typeof (targetApi as any)?.submitTransaction === "function") {
          res = await (targetApi as any).submitTransaction(txHex);
        } else if (typeof (targetApi as any)?.submitTx === "function") {
          res = await (targetApi as any).submitTx(txHex);
        } else {
          throw new Error("Connected wallet does not support submitTransaction");
        }
        console.log("1AM submitTransaction response:", res);
        
        let txId: string = "";
        if (typeof res === "string" && res.length > 0) {
          txId = res.replace(/^0x/, "");
        } else if (typeof res === "object" && res !== null) {
          const r = res as Record<string, any>;
          txId = (r.txHash || r.hash || r.transactionHash || r.txId || r.id || "")?.replace(/^0x/, "");
        }
        if (!txId) {
          txId = computedExtrinsicHash;
        }
        lastSubmittedTxId = txId;
        return txId as any;
      },
    },
  };

  return providers;
}
