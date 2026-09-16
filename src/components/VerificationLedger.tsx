import type { VerificationRecord } from "../utils/contract";

export function VerificationLedger({
  records,
}: {
  records: VerificationRecord[];
}) {
  return (
    <div className="ledger-grain rounded-2xl border border-ink-600 bg-ink-800 p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-medium text-brass-400 mb-1">
            Written to Preprod
          </p>
          <h2 className="font-display text-2xl">Public verification log</h2>
        </div>
        <span className="rounded-full border border-ink-600 px-3 py-1 text-xs text-text-mid">
          {records.length} {records.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {records.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {records.map((r) => (
            <li
              key={r.nullifier + r.timestamp}
              className="rounded-lg border border-ink-600 bg-ink-900 px-4 py-3.5 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm text-text-hi">{r.gateLabel}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <p className="font-mono text-[11px] text-text-low truncate max-w-[120px]">
                    nullifier {r.nullifier.slice(0, 16)}…
                  </p>
                  {r.explorerUrl && (
                    <a href={r.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-brass-400 hover:text-brass-300 transition-colors underline underline-offset-2">
                      View Tx ↗
                    </a>
                  )}
                </div>
              </div>
              <VerifiedBadge verified={r.verified} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 rounded-lg border border-dashed border-ink-600 px-4 py-3 text-xs text-text-low leading-relaxed">
        Only the nullifier and the pass/fail result live here. The
        attribute value, issuer identity, and expiry date behind each
        proof never touch this ledger.
      </div>
    </div>
  );
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
        verified
          ? "bg-sage-500/15 text-sage-500"
          : "bg-clay-500/15 text-clay-500"
      }`}
    >
      {verified ? "Verified" : "Did not clear"}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-ink-600 px-4 py-8 text-center">
      <p className="text-sm text-text-mid">
        No proofs submitted yet — this ledger fills in as gates get
        verified.
      </p>
    </div>
  );
}
