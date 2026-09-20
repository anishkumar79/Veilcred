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

// The DApp connector v4 Wallet API interface that implements shielded operations
export interface WalletConnectorAPI {
  getConfiguration(): Promise<{ proverServerUri?: string; indexerUri: string; indexerWsUri: string }>;
  getShieldedAddresses(): Promise<{ shieldedCoinPublicKey: string; shieldedEncryptionPublicKey: string }>;
  balanceUnsealedTransaction(tx: string): Promise<{ tx: string }>;
  submitTransaction(tx: string): Promise<void>;
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
      const base = indexerPublicDataProvider(indexerUri, indexerWsUri);
      return {
        ...base,
        watchForDeployTxData: async (addr: string) => {
          const data: any = await base.watchForDeployTxData(addr);
          return data && typeof data === "object" ? { ...data, version: "v9" } : data;
        },
        watchForTxData: async (txId: string) => {
          const data: any = await base.watchForTxData(txId);
          return data && typeof data === "object" ? { ...data, version: "v9" } : data;
        },
      } as any;
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
        const txHex = toHex(tx.serialize());
        console.log("Submitting transaction to 1AM wallet for approval popup...");
        let res: any;
        const ap = api as any;
        if (typeof ap.submitTransaction === "function") {
          res = await ap.submitTransaction(txHex);
        } else if (typeof ap.submitTx === "function") {
          res = await ap.submitTx(txHex);
        } else {
          throw new Error("Connected wallet does not support submitTransaction");
        }
        console.log("1AM submitTransaction response:", res);
        
        let txId: string = "";
        if (typeof res === "string" && res.length > 0) {
          txId = res.replace(/^0x/, "");
        } else if (typeof res === "object" && res !== null) {
          txId = (res.txHash || res.hash || res.transactionHash || res.txId || res.id || "")?.replace(/^0x/, "");
        }
        if (!txId) {
          const txIdentifiers = tx.identifiers();
          txId = txIdentifiers[0] ? String(txIdentifiers[0]).replace(/^0x/, "") : "";
        }
        return txId as any;
      },
    },
  };

  return providers;
}
