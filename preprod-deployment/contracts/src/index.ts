// SPDX-License-Identifier: Apache-2.0
// Veilcred contract entry-point — replaces the old bboard stub.

import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

export * from "./managed/veilcred/contract/index.js";
export * from "./witnesses";

import * as CompiledVeilcredContract from "./managed/veilcred/contract/index.js";
import * as Witnesses from "./witnesses";

class ContractWrapper extends CompiledVeilcredContract.Contract<any, any> {
  constructor() {
    super(Witnesses.witnesses);
  }
}

/**
 * The fully compiled Veilcred contract, ready to be passed to
 * deployContract() / findDeployedContract() from midnight-js-contracts.
 *
 * Named CompiledBBoardContractContract for backwards-compat with the
 * deploy-gatecheck launcher which imports it by that name.
 */
export const CompiledBBoardContractContract = CompiledContract.make(
  "veilcred",
  ContractWrapper as any
).pipe(
  CompiledContract.withCompiledFileAssets("./managed/veilcred")
) as any;
