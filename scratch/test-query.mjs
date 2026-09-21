import { ContractState, StateValue, ChargedState, ContractOperation } from "@midnight-ntwrk/compact-runtime";
import { deserializeLedgerParameters, toHex } from "@midnight-ntwrk/midnight-js-utils";
import fs from "fs";

const contractAddress = "5c05efc1a9fcd0a0ea1f498d8622c3bf67e99ea5983345fbc1a10440817e2127";

async function main() {
  const res = await fetch("https://indexer.preprod.midnight.network/api/v4/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query {
        contractAction(address: "${contractAddress}") {
          state
          transaction { hash }
        }
        block {
          hash
          height
          ledgerParameters
        }
      }`
    })
  });
  const json = await res.json();
  const stateHex = json.data?.contractAction?.state;
  console.log("stateHex length:", stateHex?.length);
  const state = new ContractState();
  let sv = StateValue.newArray();
  sv = sv.arrayPush(StateValue.newNull());
  sv = sv.arrayPush(StateValue.newNull());
  sv = sv.arrayPush(StateValue.newNull());
  state.data = new ChargedState(sv);
  ['registerIssuer', 'verifyThreshold', 'isVerified'].forEach(id => {
    const op = new ContractOperation();
    state.setOperation(id, op);
  });
  console.log("Locally created ContractState:", state instanceof ContractState);
  console.log("Operations:", state.operations());
  console.log("Operation verifyThreshold:", state.operation("verifyThreshold") instanceof ContractOperation);
}

main().catch(console.error);
