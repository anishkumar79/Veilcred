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
  
  // Type generic is `any` here to bypass needing the generated circuit keys interface
  const keyMaterialProvider = new FetchZkConfigProvider<any>(zkConfigPath, fetch.bind(window));
  
  // Get the active network configuration from the 1am wallet
  const config = await api.getConfiguration();
  
  // Fetch the wallet's shielded addresses for receiving funds/tokens if necessary
  const shieldedAddresses = await api.getShieldedAddresses();

  const providers = {
    // We don't use a persistent private state provider here for Veilcred, just passing a mock
    // since the credential proof is stateless on the verifier side.
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
    proofProvider: httpClientProofProvider(config.proverServerUri || 'https://proof-server.preprod.midnight.network', keyMaterialProvider),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    walletProvider: {
      getCoinPublicKey: () => shieldedAddresses.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shieldedAddresses.shieldedEncryptionPublicKey,
      balanceTx: async (tx: UnboundTransaction): Promise<FinalizedTransaction> => {
        const serializedTx = toHex(tx.serialize());
        const received = await api.balanceUnsealedTransaction(serializedTx);
        return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
          "signature",
          "proof",
          "binding",
          fromHex(received.tx),
        );
      },
    } as any, // Typed as any to bypass strict internal typing for the hackathon
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        await api.submitTransaction(toHex(tx.serialize()));
        const txIdentifiers = tx.identifiers();
        return txIdentifiers[0]!;
      },
    },
  };

  return providers;
}
