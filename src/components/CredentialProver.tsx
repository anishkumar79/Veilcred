import { useState, type FormEvent } from "react";
import type { MidnightStatus } from "../hooks/useMidnight";
import type { CredentialInput } from "../utils/contract";

interface CredentialProverProps {
  status: MidnightStatus;
  error: string | null;
  connected: boolean;
  onProve: (input: CredentialInput) => void;
}

const GATE_PRESETS = [
  { label: "Age 18+ gate", threshold: 18, placeholder: "Your age" },
  { label: "KYC tier 2 gate", threshold: 2, placeholder: "Your KYC tier" },
  { label: "Active license gate", threshold: 1, placeholder: "License status (1 = active)" },
];

export function CredentialProver({
  status,
  error,
  connected,
  onProve,
}: CredentialProverProps) {
  const [presetIndex, setPresetIndex] = useState(0);
  const [attributeValue, setAttributeValue] = useState("");
  const [issuerKey, setIssuerKey] = useState("did:midnight:approved-issuer-01");
  const [holderSecret, setHolderSecret] = useState("");
  const [expiryDays, setExpiryDays] = useState("365");

  const preset = GATE_PRESETS[presetIndex];
  const busy = status === "proving" || status === "submitting";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(attributeValue);
    if (Number.isNaN(value)) return;

    const secret =
      holderSecret.trim().length > 0
        ? holderSecret
        : cryptoRandom();

    onProve({
      gateLabel: preset.label,
      attributeValue: value,
      threshold: preset.threshold,
      expiryTimestamp:
        Math.floor(Date.now() / 1000) + Number(expiryDays || "0") * 86400,
      issuerKey,
      holderSecret: secret,
    });
  }

  return (
    <div className="rounded-2xl border border-brass-600/40 bg-paper-100 text-ink-950 p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-medium text-brass-600 mb-1">
            Stays on your device
          </p>
          <h2 className="font-display text-2xl">Your credential</h2>
        </div>
        <LockGlyph />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="gate" className="block text-sm mb-1.5 text-ink-800">
            What are you proving?
          </label>
          <select
            id="gate"
            value={presetIndex}
            onChange={(e) => setPresetIndex(Number(e.target.value))}
            className="w-full rounded-lg border border-paper-300 bg-white px-3 py-2.5 text-sm focus-visible:outline-brass-600"
          >
            {GATE_PRESETS.map((g, i) => (
              <option key={g.label} value={i}>
                {g.label} (threshold: {g.threshold})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="attribute"
            className="block text-sm mb-1.5 text-ink-800"
          >
            {preset.placeholder}
          </label>
          <input
            id="attribute"
            type="number"
            required
            value={attributeValue}
            onChange={(e) => setAttributeValue(e.target.value)}
            placeholder="e.g. 24"
            className="w-full rounded-lg border border-paper-300 bg-white px-3 py-2.5 text-sm focus-visible:outline-brass-600"
          />
          <p className="mt-1 text-xs text-ink-800/60">
            This exact number is never disclosed — only whether it clears
            the threshold.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="issuer"
              className="block text-sm mb-1.5 text-ink-800"
            >
              Issuer key
            </label>
            <input
              id="issuer"
              type="text"
              value={issuerKey}
              onChange={(e) => setIssuerKey(e.target.value)}
              className="w-full rounded-lg border border-paper-300 bg-white px-3 py-2.5 text-xs font-mono focus-visible:outline-brass-600"
            />
          </div>
          <div>
            <label
              htmlFor="expiry"
              className="block text-sm mb-1.5 text-ink-800"
            >
              Expires in (days)
            </label>
            <input
              id="expiry"
              type="number"
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
              className="w-full rounded-lg border border-paper-300 bg-white px-3 py-2.5 text-sm focus-visible:outline-brass-600"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="secret"
            className="block text-sm mb-1.5 text-ink-800"
          >
            Holder secret{" "}
            <span className="text-ink-800/50 font-normal">(optional)</span>
          </label>
          <input
            id="secret"
            type="text"
            value={holderSecret}
            onChange={(e) => setHolderSecret(e.target.value)}
            placeholder="Leave blank to generate one"
            className="w-full rounded-lg border border-paper-300 bg-white px-3 py-2.5 text-sm font-mono focus-visible:outline-brass-600"
          />
          <p className="mt-1 text-xs text-ink-800/60">
            Used to derive your nullifier. Keep it — you'll need the same
            secret to prove this credential again without linking the two
            proofs together.
          </p>
        </div>

        <button
          type="submit"
          disabled={busy || !connected}
          className="w-full rounded-lg bg-ink-900 text-paper-100 py-3 text-sm font-medium hover:bg-ink-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {!connected
            ? "Connect a wallet to continue"
            : status === "proving"
            ? "Generating proof…"
            : status === "submitting"
            ? "Submitting to Preprod…"
            : "Generate proof"}
        </button>

        {error && (
          <p className="text-sm text-clay-500 bg-clay-500/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

function cryptoRandom(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function LockGlyph() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
        stroke="#96712F"
        strokeWidth="1.6"
      />
      <path
        d="M8 10V7a4 4 0 0 1 8 0v3"
        stroke="#96712F"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
