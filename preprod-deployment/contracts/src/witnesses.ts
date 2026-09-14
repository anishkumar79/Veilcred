import { Ledger } from "./managed/bboard/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

export type VeilcredPrivateState = {
  readonly issuerKey?: Uint8Array;
  readonly attributeValue?: bigint;
  readonly expiry?: bigint;
  readonly signature?: Uint8Array;
  readonly holderSecret?: Uint8Array;
};

export const createVeilcredPrivateState = (
  state?: Partial<VeilcredPrivateState>
): VeilcredPrivateState => ({
  issuerKey: state?.issuerKey ?? new Uint8Array(32),
  attributeValue: state?.attributeValue ?? 0n,
  expiry: state?.expiry ?? 0n,
  signature: state?.signature ?? new Uint8Array(64),
  holderSecret: state?.holderSecret ?? new Uint8Array(32),
});

export const witnesses = {
  issuerKey: ({
    privateState,
  }: WitnessContext<Ledger, VeilcredPrivateState>): [
    VeilcredPrivateState,
    Uint8Array,
  ] => [privateState, privateState?.issuerKey ?? new Uint8Array(32)],

  attributeValue: ({
    privateState,
  }: WitnessContext<Ledger, VeilcredPrivateState>): [
    VeilcredPrivateState,
    bigint,
  ] => [privateState, privateState?.attributeValue ?? 0n],

  expiry: ({
    privateState,
  }: WitnessContext<Ledger, VeilcredPrivateState>): [
    VeilcredPrivateState,
    bigint,
  ] => [privateState, privateState?.expiry ?? 0n],

  signature: ({
    privateState,
  }: WitnessContext<Ledger, VeilcredPrivateState>): [
    VeilcredPrivateState,
    Uint8Array,
  ] => [privateState, privateState?.signature ?? new Uint8Array(64)],

  holderSecret: ({
    privateState,
  }: WitnessContext<Ledger, VeilcredPrivateState>): [
    VeilcredPrivateState,
    Uint8Array,
  ] => [privateState, privateState?.holderSecret ?? new Uint8Array(32)],
};
