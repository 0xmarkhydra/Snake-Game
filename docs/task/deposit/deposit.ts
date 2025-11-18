// @ts-nocheck
/**
 * Example: Deposit tokens using VaultSDK
 * 
 * This example demonstrates how to:
 * 1. Initialize the SDK
 * 2. Build an unsigned deposit transaction
 * 3. Sign the transaction with a wallet
 * 4. Submit to Solana network
 */

import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { VaultSDK, PROGRAM_ID, RPC_ENDPOINTS } from "../../../sdk/dist/index";
import * as fs from "fs";
import * as path from "path";

/**
 * Configuration
 */
const CONFIG = {
  // RPC endpoint
  rpcEndpoint: RPC_ENDPOINTS.devnet,
  
  // Token mint address (example: USDC devnet)
  // Replace with your token mint
  mintAddress: "EweSxUxv3RRwmGwV4i77DkSgkgQt3CHbQc62YEwDEzC9", // USDC devnet
  
  // Amount to deposit (in raw token units)
  // For USDC with 6 decimals: 1000000 = 1 USDC
  depositAmount: 1_000_000, // 1 token
  
  // Path to your wallet keypair JSON file
  // You can generate one with: solana-keygen new --outfile wallet.json
  walletKeypairPath: path.join(process.env.HOME || "", ".config/solana/devnet-wallet.json"),
};

/**
 * Load wallet keypair from file
 */
function loadWalletKeypair(filepath: string): Keypair {
  try {
    const keypairData = JSON.parse(fs.readFileSync(filepath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(keypairData));
  } catch (error) {
    throw new Error(`Failed to load wallet from ${filepath}: ${error}`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log("🚀 VaultSDK Deposit Example\n");

  // Step 1: Setup connection
  console.log("📡 Connecting to Solana...");
  const connection = new Connection(CONFIG.rpcEndpoint, "confirmed");
  console.log(`   Connected to: ${CONFIG.rpcEndpoint}\n`);

  // Step 2: Load wallet
  console.log("🔑 Loading wallet...");
  const wallet = loadWalletKeypair(CONFIG.walletKeypairPath);
  const walletPubkey = wallet.publicKey;
  console.log(`   Wallet: ${walletPubkey.toString()}`);

  // Check wallet balance
  const balance = await connection.getBalance(walletPubkey);
  console.log(`   SOL Balance: ${balance / 1e9} SOL\n`);

  if (balance === 0) {
    console.log("⚠️  Wallet has no SOL. Please airdrop some SOL first:");
    console.log(`   solana airdrop 1 ${walletPubkey.toString()} --url devnet\n`);
    return;
  }

  // Step 3: Initialize SDK
  console.log("🔧 Initializing VaultSDK...");
  const sdk = new VaultSDK({
    connection,
    programId: PROGRAM_ID,
  });
  console.log(`   Program ID: ${PROGRAM_ID.toString()}\n`);

  // Step 4: Check if vault is initialized
  console.log("🔍 Checking vault status...");
  const isInitialized = await sdk.isInitialized();
  
  if (!isInitialized) {
    console.log("❌ Vault is not initialized yet.");
    console.log("   Please initialize the vault first using the initialize example.\n");
    return;
  }
  console.log("✅ Vault is initialized\n");

  // Get vault config
  const config = await sdk.getConfig();
  console.log("📋 Vault Configuration:");
  console.log(`   Admin: ${config.admin.toString()}`);
  console.log(`   Mint: ${config.mint.toString()}\n`);

  // Verify mint matches
  const mintPubkey = new PublicKey(CONFIG.mintAddress);
  if (!config.mint.equals(mintPubkey)) {
    console.log("⚠️  Warning: Mint in config doesn't match your mint!");
    console.log(`   Expected: ${CONFIG.mintAddress}`);
    console.log(`   Found: ${config.mint.toString()}\n`);
    console.log("   Using mint from config...\n");
  }

  // Step 5: Get vault balance before deposit
  console.log("💰 Checking vault balance before deposit...");
  try {
    const vaultBalance = await sdk.getVaultBalance(config.mint);
    console.log(`   Current balance: ${vaultBalance.formatted} tokens`);
    console.log(`   Raw amount: ${vaultBalance.amount}\n`);
  } catch (error) {
    console.log(`   Vault token account not found (will be created)\n`);
  }

  // Step 6: Build deposit transaction
  console.log("🏗️  Building deposit transaction...");
  console.log(`   Amount: ${CONFIG.depositAmount} (raw units)`);
  
  let depositTx;
  try {
    depositTx = await sdk.buildDepositTransaction({
      amount: CONFIG.depositAmount,
      user: walletPubkey,
      mint: config.mint,
    });
    console.log("✅ Transaction built successfully\n");
  } catch (error) {
    console.error("❌ Failed to build transaction:", error);
    return;
  }

  // Step 7: Sign and send transaction
  console.log("✍️  Signing and sending transaction...");
  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      depositTx,
      [wallet], // Signers
      {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      }
    );

    console.log("✅ Transaction confirmed!\n");
    console.log("📝 Transaction Details:");
    console.log(`   Signature: ${signature}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);
  } catch (error: any) {
    console.error("❌ Transaction failed:", error.message);
    if (error.logs) {
      console.error("\n📋 Transaction logs:");
      error.logs.forEach((log: string) => console.error(`   ${log}`));
    }
    return;
  }

  // Step 8: Verify new vault balance
  console.log("🔍 Verifying vault balance after deposit...");
  try {
    const newVaultBalance = await sdk.getVaultBalance(config.mint);
    console.log(`   New balance: ${newVaultBalance.formatted} tokens`);
    console.log(`   Raw amount: ${newVaultBalance.amount}\n`);
  } catch (error) {
    console.log(`   Could not fetch new balance: ${error}\n`);
  }

  console.log("🎉 Deposit completed successfully!");
}

/**
 * Run the example
 */
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });

