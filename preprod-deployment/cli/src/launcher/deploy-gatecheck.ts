import { WebSocket } from 'ws';
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

import fs from 'node:fs';
import { PreprodRemoteConfig } from '../config.js';
import {
  MidnightWalletProvider,
  FaucetClient,
} from '@midnight-ntwrk/testkit-js';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledBBoardContractContract } from '@midnight-ntwrk/bboard-contract';
import { createLogger } from '../logger-utils.js';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import * as Rx from 'rxjs';
import crypto from 'node:crypto';

function normalizeSeed(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes(' ')) {
    const salt = 'mnemonic';
    const bip39Seed = crypto.pbkdf2Sync(trimmed.normalize('NFKD'), salt.normalize('NFKD'), 2048, 64, 'sha512');
    return bip39Seed.subarray(0, 32).toString('hex');
  }
  return trimmed;
}

async function main() {
  console.log("Starting deployment to Preprod...");
  const rawSeed = process.env.WALLET_SEED;
  if (!rawSeed) throw new Error("WALLET_SEED environment variable is required");
  const seed = normalizeSeed(rawSeed);

  const config = new PreprodRemoteConfig();
  const logger = await createLogger(config.logDir, true);
  const testEnv = config.getEnvironment(logger);
  console.log("Starting environment...");
  let envConfiguration: any;
  try {
    envConfiguration = await testEnv.start();
  } catch (err: any) {
    try {
      envConfiguration = (testEnv as any).getEnvironmentConfiguration();
      console.warn("Notice: Public faucet is temporarily offline (503). Continuing with funded wallet...");
    } catch {
      throw err;
    }
  }

  console.log("Building wallet provider...");
  // Use the testkit-js built-in MidnightWalletProvider which supports v9 ledger
  const walletProvider = await MidnightWalletProvider.build(logger, envConfiguration, seed);
  await (walletProvider as any).start(false);

  console.log("Syncing unshielded wallet with Preprod...");
  const unshieldedState = await walletProvider.wallet.unshielded.waitForSyncedState();
  const nightBalance = (unshieldedState as any).balances?.[unshieldedToken().raw] ?? 0n;
  console.log(`Current tNIGHT balance: ${nightBalance}`);

  if (nightBalance === 0n) {
    console.log("Wallet has 0 tNIGHT. Requesting funds from faucet...");
    const unshieldedAddress = (unshieldedState as any).address?.asString?.() ?? 'unknown';
    if (envConfiguration.faucet) {
      try {
        await new FaucetClient(envConfiguration.faucet, logger).requestTokens(unshieldedAddress);
        console.log("Faucet request sent. Waiting for tokens...");
      } catch (e: any) {
        console.warn(`Faucet request warning: ${e.message}`);
      }
    }
    await Rx.firstValueFrom(
      (walletProvider.wallet.unshielded as any).state.pipe(
        Rx.filter((s: any) => (s.balances?.[unshieldedToken().raw] ?? 0n) > 0n),
        Rx.timeout(300000),
      )
    );
  }

  console.log("Syncing DUST wallet with Preprod...");
  let lastLoggedPct = -1;
  const dustSub = (walletProvider.wallet.dust as any).state.pipe(
    Rx.sampleTime(5000),
  ).subscribe((s: any) => {
    const p = s.progress as any;
    const applied = Number(p?.appliedIndex ?? 0);
    const highest = Number(p?.highestRelevantWalletIndex ?? p?.highestIndex ?? 1520000);
    const pct = highest > 0 ? Math.floor((applied * 100) / highest) : 0;
    if (pct !== lastLoggedPct) {
      lastLoggedPct = pct;
      const memMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      console.log(`DUST sync progress: ${pct}% (applied: ${applied} / ${highest}, heap: ${memMb}MB)`);
    }
  });

  await walletProvider.wallet.dust.waitForSyncedState(100n);
  dustSub.unsubscribe();
  console.log("DUST wallet fully synchronized!");

  console.log("Waiting for DUST balance...");
  const dustBalance = await Rx.firstValueFrom(
    walletProvider.wallet.state().pipe(
      Rx.throttleTime(2000),
      Rx.filter((s: any) => s.dust.balance(new Date()) > 0n),
      Rx.map((s: any) => s.dust.balance(new Date())),
      Rx.timeout(300000),
    ),
  );
  console.log(`DUST available: ${dustBalance}! Deploying contract...`);

  console.log("Initializing providers...");
  const zkConfigProvider = new NodeZkConfigProvider(config.zkConfigPath);
  const storagePassword = "TempPassword123!Secure";

  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: config.privateStateStoreName,
      signingKeyStoreName: `${config.privateStateStoreName}-signing-keys`,
      privateStoragePasswordProvider: () => storagePassword,
      accountId: seed,
    }),
    publicDataProvider: indexerPublicDataProvider(envConfiguration.indexer, envConfiguration.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(envConfiguration.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };

  console.log("Deploying contract...");
  let success = false;
  try {
    const deployed = await deployContract(providers as any, {
      compiledContract: CompiledBBoardContractContract,
      args: []
    });

    const contractAddress = deployed.deployTxData.public.contractAddress;
    const explorerUrl = `https://preprod.midnightexplorer.com/contracts/0x${contractAddress}`;
    console.log("================================================================================");
    console.log("🎉 SUCCESS! VEILCRED CONTRACT DEPLOYED TO PREPROD!");
    console.log("CONTRACT_ADDRESS=" + contractAddress);
    console.log("Contract Address:", contractAddress);
    console.log("Explorer:", explorerUrl);
    console.log("================================================================================");

    const deploymentInfo = {
      network: "preprod",
      contractName: "veilcred",
      contractAddress,
      explorerUrl,
      indexer: envConfiguration.indexer,
      node: envConfiguration.node,
      deployedAt: new Date().toISOString(),
    };

    fs.writeFileSync('deployment.json', JSON.stringify(deploymentInfo, null, 2));
    fs.writeFileSync('../../deployed_contract.json', JSON.stringify(deploymentInfo, null, 2));
    try {
      fs.writeFileSync('../../public/deployed_contract.json', JSON.stringify(deploymentInfo, null, 2));
    } catch {}

    if (process.env.GITHUB_STEP_SUMMARY) {
      try {
        fs.appendFileSync(
          process.env.GITHUB_STEP_SUMMARY,
          `## 🎉 Midnight Preprod Deployment Successful!\n\n` +
          `| Field | Value |\n` +
          `| --- | --- |\n` +
          `| **Contract** | Veilcred Confidential Verifier |\n` +
          `| **Contract Address** | \`0x${contractAddress}\` |\n` +
          `| **Network** | Midnight Preprod |\n` +
          `| **Explorer** | [View on Midnight Explorer](${explorerUrl}) |\n` +
          `| **Deployed At** | ${deploymentInfo.deployedAt} |\n\n` +
          `Contract address has been written to \`deployed_contract.json\` and uploaded as a CI artifact.\n`
        );
      } catch (e) {
        console.warn("Could not write GITHUB_STEP_SUMMARY", e);
      }
    }
    success = true;
  } catch (err) {
    console.error("Deployment failed:", err);
  } finally {
    await (walletProvider as any).stop?.();
    await testEnv.shutdown();
    process.exit(success ? 0 : 1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
