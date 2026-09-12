import { Layout } from "./components/Layout";
import { WalletConnect } from "./components/WalletConnect";
import { CredentialProver } from "./components/CredentialProver";
import { VerificationLedger } from "./components/VerificationLedger";
import { useMidnight } from "./hooks/useMidnight";

function App() {
  const { status, wallet, error, ledger, connect, disconnect, prove } =
    useMidnight();

  return (
    <Layout>
      <section id="top" className="mx-auto max-w-6xl px-6 pt-16 pb-14">
        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-10 items-center">
          <div>
            <h1 className="font-display text-5xl sm:text-6xl leading-[1.05] tracking-tight">
              Prove it.
              <br />
              Don't show it.
            </h1>
            <p className="mt-6 text-lg text-text-mid max-w-lg leading-relaxed">
              Veilcred checks that a credential clears a bar — an age, a
              tier, a license status — and puts only that yes-or-no answer
              on the ledger. The credential itself never leaves your
              device.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <WalletConnect
                status={status}
                wallet={wallet}
                onConnect={connect}
                onDisconnect={disconnect}
              />
              <a
                href="#docs"
                className="text-sm text-text-mid hover:text-text-hi underline underline-offset-4 transition-colors"
              >
                See how the proof works
              </a>
            </div>
          </div>

          <div className="hidden lg:flex justify-center">
            <SealIllustration />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <CredentialProver
            status={status}
            error={error}
            connected={!!wallet}
            onProve={prove}
          />
          <VerificationLedger records={ledger} />
        </div>
      </section>

      <section id="docs" className="border-t border-ink-700">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="font-display text-3xl mb-10">How the proof works</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <Step
              n="1"
              title="Enter your credential"
              body="The real value — your age, tier, or license status — is typed into your own browser. It's used as a private circuit witness and is never sent anywhere as plaintext."
            />
            <Step
              n="2"
              title="Generate the proof"
              body="A zero-knowledge circuit checks the issuer's signature, the expiry date, and whether your value clears the threshold — entirely on your device."
            />
            <Step
              n="3"
              title="Only the result is disclosed"
              body="The contract writes a nullifier and a pass/fail boolean to Preprod. Anyone can verify the outcome; no one can see what was behind it."
            />
          </div>
        </div>
      </section>
    </Layout>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-brass-500/50 font-display text-brass-400">
        {n}
      </div>
      <h3 className="font-display text-lg mb-2">{title}</h3>
      <p className="text-sm text-text-mid leading-relaxed">{body}</p>
    </div>
  );
}

function SealIllustration() {
  return (
    <svg width="280" height="280" viewBox="0 0 280 280" fill="none" aria-hidden="true">
      <circle cx="140" cy="140" r="120" fill="#1b1e2b" />
      <circle cx="140" cy="140" r="120" stroke="#B98B3E" strokeWidth="1.5" />
      <circle cx="140" cy="140" r="104" stroke="#383d54" strokeWidth="1" strokeDasharray="2 6" />
      <path d="M140 62 L156 96 L140 86 L124 96 Z" fill="#B98B3E" />
      <circle cx="140" cy="158" r="42" stroke="#B98B3E" strokeWidth="3" fill="none" />
      <path
        d="M120 158 L134 172 L162 144"
        stroke="#EDEAE1"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default App;
