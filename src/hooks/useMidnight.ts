import { useCallback, useState } from "react";
import {
  connectWallet,
  disconnectWallet,
  submitVerification,
  type CredentialInput,
  type VerificationRecord,
  type WalletState,
} from "../utils/contract";

export type MidnightStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "proving"
  | "submitting"
  | "error";

/**
 * useMidnight
 * -----------
 * Central hook for all wallet + contract interaction. Components never
 * talk to the wallet or the contract client directly — everything routes
 * through here so proof generation, submission, and error states stay
 * consistent across the app.
 *
 * NOTE FOR INTEGRATORS: the actual Midnight wallet connector and the
 * generated contract client (from `managed/`, produced by
 * `compact compile`) are wired up in `src/utils/contract.ts`. This hook
 * is deliberately SDK-agnostic so swapping in the real
 * `@midnight-ntwrk/dapp-connector-api` / generated contract types only
 * touches that one file.
 */
export function useMidnight() {
  const [status, setStatus] = useState<MidnightStatus>("idle");
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ledger, setLedger] = useState<VerificationRecord[]>([]);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      const w = await connectWallet();
      setWallet(w);
      setStatus("connected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect wallet");
      setStatus("error");
    }
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectWallet();
    setWallet(null);
    setStatus("idle");
  }, []);

  const prove = useCallback(
    async (input: CredentialInput) => {
      if (!wallet) {
        setError("Connect a wallet before generating a proof");
        setStatus("error");
        return null;
      }
      setError(null);
      try {
        setStatus("proving");
        // Proof generation happens entirely client-side: the raw
        // credential fields in `input` never leave this function scope
        // as plaintext beyond being fed to the circuit witnesses.
        setStatus("submitting");
        const record = await submitVerification(wallet, input);
        setLedger((prev) => [record, ...prev]);
        setStatus("connected");
        return record;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Verification failed");
        setStatus("error");
        return null;
      }
    },
    [wallet]
  );

  return { status, wallet, error, ledger, connect, disconnect, prove };
}
