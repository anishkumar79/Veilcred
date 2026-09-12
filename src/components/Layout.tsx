import type { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-ink-950 text-text-hi">
      <header className="border-b border-ink-700">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-3">
            <SealMark />
            <span className="font-display text-xl tracking-tight">
              Veilcred
            </span>
          </a>
          <nav className="flex items-center gap-6 text-sm text-text-mid">
            <a
              href="https://github.com"
              className="hover:text-text-hi transition-colors"
            >
              GitHub
            </a>
            <a
              href="#docs"
              className="hover:text-text-hi transition-colors"
            >
              How it works
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-ink-700">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-text-low">
          <p>Built on Midnight · Preprod</p>
          <p className="font-mono text-xs">contracts/veilcred.compact</p>
        </div>
      </footer>
    </div>
  );
}

function SealMark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="30" fill="#1b1e2b" />
      <circle cx="32" cy="32" r="30" stroke="#B98B3E" strokeWidth="2" />
      <path d="M32 14 L38 26 L32 22 L26 26 Z" fill="#B98B3E" />
      <circle
        cx="32"
        cy="36"
        r="10"
        stroke="#B98B3E"
        strokeWidth="2.5"
        fill="none"
      />
      <path
        d="M27 36 L31 40 L38 32"
        stroke="#EDEAE1"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
