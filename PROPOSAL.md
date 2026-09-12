# Veilcred — Product Proposal (carried over from Level 3)

**Track:** Identity/Credentials

## Problem Statement

Digital identity and credential verification today force a broken trade-off: to
prove one narrow fact about yourself — that you're over 18, hold an active
professional license, sit above a KYC tier, or belong to an approved group —
you typically have to hand over the entire underlying document or record. A
bouncer app doesn't need your birthdate, just "yes/no, over 18." A gated
platform doesn't need your exact KYC tier or issuer details, just "meets the
threshold." Yet almost every real-world and Web3 verification flow defaults to
full disclosure because there's no accessible, verifiable way to check a
predicate without exposing the data behind it.

This over-disclosure creates three concrete harms:

1. **Privacy loss** — users leak far more personal data than the interaction
   requires, creating honeypots of sensitive information at every verifier
   they interact with.
2. **No selective trust** — verifiers must either trust a centralized identity
   provider to vouch for users, or accept raw documents they must manually
   validate, which doesn't scale and is easy to forge.
3. **Reusability without linkability** — existing systems can't cleanly answer
   "has this credential already been used here?" without either linking all
   of a user's activity together, or allowing unlimited reuse and fraud.

Blockchains make this worse by default: state is public, so naively porting
credential checks on-chain permanently exposes the underlying data to
everyone, forever.

**The gap this fills:** a reusable Compact pattern where the credential stays
private, the predicate check happens off the public record, and only the
minimal disclosed fact — a verified boolean plus a one-time nullifier — ever
touches the ledger.

## Idea

**Veilcred** is a Compact contract + frontend that lets a user prove a
credential predicate is true — e.g., credential is unexpired, issued by an
approved authority, and meets a threshold (age ≥ 18, tier ≥ 2, license status
= active) — without revealing the credential's actual contents.

- The credential (issuer signature, attribute value, expiry) is a **private
  circuit witness** — never touches the ledger in raw form.
- The circuit checks issuer approval, signature validity, and expiry, then
  evaluates the threshold predicate.
- Only the **boolean result** is passed through `disclose()` and written to
  the public ledger, tied to a **nullifier** that prevents reuse on the same
  gate without linking separate uses of the credential to each other.

## Why Midnight

Midnight's private-by-default circuit inputs and explicit `disclose()`
boundary are exactly the primitive this idea needs: developers get to decide,
field by field, what becomes public — rather than bolting privacy on after
the fact with off-chain workarounds.

## Level 4 Scope (this submission)

- `contracts/veilcred.compact` — the privacy-critical core: issuer
  registration, threshold verification circuit, nullifier derivation, and a
  public read helper.
- A frontend where a user can connect a wallet, enter a mock credential
  locally, generate a proof against a chosen threshold gate, and see the
  resulting public ledger entry (nullifier + verified boolean only).
- CI running tests and a production build on every push.
- Documentation covering setup, usage, and the exact privacy model.

## Path to Level 5/6

- Real issuer onboarding (multiple approved issuers, revocation list).
- Pluggable predicate types beyond `>=` (range checks, set membership).
- Contract-to-contract calls so other Midnight dApps can gate access by
  querying `isVerified` directly instead of re-running a proof.
- Mainnet deployment at Level 6.
<!-- Proposal metadata -->
