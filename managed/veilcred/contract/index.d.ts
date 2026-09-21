import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  issuerKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  attributeValue(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  expiry(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  signature(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  holderSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  registerIssuer(context: __compactRuntime.CircuitContext<PS>,
                 issuerKey_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  verifyThreshold(context: __compactRuntime.CircuitContext<PS>,
                  gateId_0: Uint8Array,
                  threshold_0: bigint,
                  currentTime_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  isVerified(context: __compactRuntime.CircuitContext<PS>,
             nullifier_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
}

export type ProvableCircuits<PS> = {
  registerIssuer(context: __compactRuntime.CircuitContext<PS>,
                 issuerKey_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  verifyThreshold(context: __compactRuntime.CircuitContext<PS>,
                  gateId_0: Uint8Array,
                  threshold_0: bigint,
                  currentTime_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  isVerified(context: __compactRuntime.CircuitContext<PS>,
             nullifier_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
}

export type PureCircuits = {
  verifySig(issuer_0: Uint8Array, sig_0: Uint8Array): boolean;
}

export type Circuits<PS> = {
  registerIssuer(context: __compactRuntime.CircuitContext<PS>,
                 issuerKey_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  verifySig(context: __compactRuntime.CircuitContext<PS>,
            issuer_0: Uint8Array,
            sig_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  verifyThreshold(context: __compactRuntime.CircuitContext<PS>,
                  gateId_0: Uint8Array,
                  threshold_0: bigint,
                  currentTime_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  isVerified(context: __compactRuntime.CircuitContext<PS>,
             nullifier_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
}

export type Ledger = {
  approvedIssuers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  usedNullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  verifications: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
