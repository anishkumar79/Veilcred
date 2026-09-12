import type { MidnightStatus } from "../hooks/useMidnight";
import type { WalletState } from "../utils/contract";

interface WalletConnectProps {
  status: MidnightStatus;
  wallet: WalletState | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WalletConnect({
  status,
  wallet,
  onConnect,
  onDisconnect,
}: WalletConnectProps) {
  if (wallet) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-ink-600 bg-ink-800 px-4 py-2.5">
        <span
          className="h-2 w-2 rounded-full bg-sage-500"
          aria-hidden="true"
        />
        <div className="leading-tight">
          <p className="font-mono text-xs text-text-hi">
            {shorten(wallet.address)}
          </p>
          <p className="text-[11px] text-text-low capitalize">
            {wallet.network}
          </p>
        </div>
        <button
          onClick={onDisconnect}
          className="ml-2 text-xs text-text-low hover:text-text-hi transition-colors underline underline-offset-2"
        >
          Disconnect
        </button>
      </div>
    );
  }

  const connecting = status === "connecting";

  return (
    <button
      onClick={onConnect}
      disabled={connecting}
      className="rounded-lg bg-brass-500 px-5 py-2.5 text-sm font-medium text-ink-950 hover:bg-brass-400 disabled:opacity-60 disabled:cursor-wait transition-colors"
    >
      {connecting ? "Connecting…" : "Connect wallet"}
    </button>
  );
}

function shorten(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 10)}…${address.slice(-6)}`;
}
