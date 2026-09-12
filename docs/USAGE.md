# How to Use Veilcred

## What You Need

- A Midnight-compatible wallet (e.g. Lace with the Midnight preview
  extension) set to **Preprod**.
- Some test tokens on Preprod (see the Midnight faucet in the official docs)
  to cover transaction fees.
- A modern browser — no other software required to *use* the deployed app.

## Step-by-Step Guide

1. **Open the app.** Go to the live Preprod demo link in the README.
2. **Connect your wallet.** Click "Connect wallet" in the top-left of the
   hero section and approve the connection in your wallet extension.
3. **Choose what you're proving.** In the "Your credential" panel, pick a
   gate from the dropdown — for example, "Age 18+ gate."
4. **Enter your value.** Type in the real number the gate is checking (your
   age, your KYC tier, etc). This number stays in your browser and is never
   sent anywhere as plaintext.
5. **Set an issuer key and expiry.** For this MVP, a sample approved-issuer
   key is pre-filled; adjust the expiry window if you want to test an
   expired credential.
6. **(Optional) Set a holder secret.** Leave this blank to have one
   generated for you, or enter your own if you want to reproduce the same
   nullifier on a later visit. Save it somewhere private — it's what lets
   you prove the same credential again without creating a new, unlinked
   identity each time.
7. **Click "Generate proof."** The app builds a zero-knowledge proof against
   the circuit in `contracts/veilcred.compact`, then submits it to the
   contract on Preprod.
8. **Check the public log.** The right-hand "Public verification log" panel
   updates with a new entry: a nullifier and a "Verified" or "Did not clear"
   badge. That's the only information anyone — including Veilcred itself —
   can see about your credential.

## What Gets Proved (and What Stays Private)

| | |
|---|---|
| **Proved publicly** | The credential was signed by an approved issuer, is unexpired, and its value meets or exceeds the gate's threshold. |
| **Stays private** | The exact attribute value, which specific issuer signed it, the expiry date, and your identity. |
| **Written on-chain** | A nullifier (prevents replay on the same gate) and a single verified/not-verified boolean. |

If you run the same credential + secret through the same gate twice, you'll
get the *same* nullifier and the contract will reject the second attempt as a
replay. If you run it through a *different* gate, the nullifier will look
completely different and unrelated — there's no way to tell the two proofs
came from the same credential.

## Troubleshooting

**"Connect a wallet before generating a proof"**
You clicked "Generate proof" before connecting. Click "Connect wallet" first.

**"Credential has expired — cannot generate a valid proof"**
Your expiry window (in days) has already passed relative to now. Increase
the "Expires in (days)" value and try again.

**"No issuer key supplied"**
The issuer key field was left empty. Use the pre-filled sample issuer key,
or your own approved issuer's key if you've registered one.

**Wallet won't connect**
Confirm your wallet extension is set to the **Preprod** network, not Preview
or Mainnet — this contract is deployed on Preprod for Level 4.

**Proof says "Did not clear" even though I expected it to pass**
Double-check the threshold shown next to your selected gate in the
dropdown — your entered value needs to be greater than or equal to it.
