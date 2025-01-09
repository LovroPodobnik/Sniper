import axios from "axios";
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { Wallet } from "@project-serum/anchor";
import bs58 from "bs58";
import dotenv from "dotenv";
import { config } from "./config";
import {
  MintsDataReponse,
  QuoteResponse,
  SerializedQuoteResponse,
  SwapEventDetailsResponse,
  HoldingRecord,
  NewTokenRecord,
  HeliusTransactionResponse,
  JupiterPriceResponse,
  ErrorResponse,
  RugResponseExtended
} from "./types";
import { insertHolding, insertNewToken, removeHolding, selectTokenByMint, selectTokenByNameAndCreator } from "./tracker/db";
import { checkTokenBalance } from "./utils/token-balance";
import { formatNumber } from "./utils/format";

// Load environment variables from the .env file
dotenv.config();

export async function fetchTransactionDetails(signature: string): Promise<MintsDataReponse | null> {
  // Set function constants
  const txUrl = process.env.HELIUS_HTTPS_URI_TX || "";
  const maxRetries = config.tx.fetch_tx_max_retries;
  const retryCount = 0;

  // Add longer initial delay to allow transaction to be processed
  console.log("\n⏳ Initial delay: waiting " + config.tx.fetch_tx_initial_delay / 1000 + " seconds for transaction to be confirmed...");
  await new Promise((resolve) => setTimeout(resolve, config.tx.fetch_tx_initial_delay));

  for (let attempt = retryCount; attempt < maxRetries; attempt++) {
    try {
      // Output logs
      console.log(`\n🔄 Attempt ${attempt + 1} of ${maxRetries} to fetch transaction details...`);

      // Log the request we're about to make if verbose logging is enabled
      if (config.swap.verbose_log) {
        console.log("📤 Request URL:", txUrl);
        console.log("📤 Request Body:", {
          transactions: [signature],
          commitment: "finalized",
          encoding: "jsonParsed",
        });
      }

      const response = await axios.post<HeliusTransactionResponse>(
        txUrl,
        {
          transactions: [signature],
          commitment: "finalized",
          encoding: "jsonParsed",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: config.tx.get_timeout,
        }
      );

      // Debug response if verbose logging is enabled
      if (config.swap.verbose_log) {
        console.log("\n📥 Raw API Response:", JSON.stringify(response.data, null, 2));
      }

      // Verify if we received a valid response
      if (!response.data) {
        throw new Error("Empty response from API");
      }

      // Handle both array and object response formats
      const transactions = Array.isArray(response.data) ? response.data : response.data.transactions;
      
      if (!transactions || transactions.length === 0) {
        throw new Error("Transaction not found in response");
      }

      const transaction = transactions[0];
      if (!transaction) {
        throw new Error("Transaction details are null");
      }

      // Access the instructions property which contains account instructions
      const instructions = transaction.instructions;
      if (!instructions || !Array.isArray(instructions)) {
        throw new Error("No instructions array in transaction");
      }

      if (instructions.length === 0) {
        throw new Error("Instructions array is empty");
      }

      // Log all program IDs if verbose logging is enabled
      if (config.swap.verbose_log) {
        console.log("\n🔍 Found Program IDs in transaction:");
        instructions.forEach((ix, index) => {
          console.log(`- Instruction ${index + 1}: ${ix.programId}`);
        });
      }

      // Verify and find the instructions for the correct market maker id
      const instruction = instructions.find((ix) => ix.programId === config.liquidity_pool.radiyum_program_id);
      if (!instruction || !instruction.accounts) {
        throw new Error(`No Raydium instruction found (looking for ${config.liquidity_pool.radiyum_program_id})`);
      }

      if (!Array.isArray(instruction.accounts) || instruction.accounts.length < 10) {
        throw new Error(`Invalid Raydium instruction format (found ${instruction.accounts.length} accounts, expected >= 10)`);
      }

      // Store quote and token mints
      const accountOne = instruction.accounts[8];
      const accountTwo = instruction.accounts[9];

      // Verify if we received both quote and token mints
      if (!accountOne || !accountTwo) {
        throw new Error("Required token accounts not found in positions 8 and 9");
      }

      // Set new token and SOL mint
      let solTokenAccount = "";
      let newTokenAccount = "";
      if (accountOne === config.liquidity_pool.wsol_pc_mint) {
        solTokenAccount = accountOne;
        newTokenAccount = accountTwo;
      } else {
        solTokenAccount = accountTwo;
        newTokenAccount = accountOne;
      }

      // Output logs
      console.log("\n✅ Successfully fetched transaction details!");
      console.log(`💰 SOL Token Account: ${solTokenAccount}`);
      console.log(`🪙 New Token Account: ${newTokenAccount}\n`);

      const displayData: MintsDataReponse = {
        tokenMint: newTokenAccount,
        solMint: solTokenAccount,
      };

      return displayData;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`\n❌ Attempt ${attempt + 1} failed: ${errorMessage}`);

      // If we have more retries, wait before trying again
      if (attempt + 1 < maxRetries) {
        const delay = Math.min(4000 * Math.pow(2, attempt), 15000); // Exponential backoff with 15s max
        console.log(`⏳ Waiting ${delay / 1000} seconds before next attempt...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.log("\n❌ All attempts to fetch transaction details failed");
  return null;
}

export async function createSwapTransaction(solMint: string, tokenMint: string): Promise<string | null> {
  const quoteUrl = process.env.JUP_HTTPS_QUOTE_URI || "";
  const swapUrl = process.env.JUP_HTTPS_SWAP_URI || "";
  const rpcUrl = process.env.HELIUS_HTTPS_URI || "";
  const myWallet = new Wallet(Keypair.fromSecretKey(bs58.decode(process.env.PRIV_KEY_WALLET || "")));
  const connection = new Connection(rpcUrl);

  try {
    // Get Swap Quote
    let retryCount = 0;
    while (retryCount < config.swap.token_not_tradable_400_error_retries) {
      try {
        // Request a quote in order to swap SOL for new token
        const quoteResponse = await axios.get<QuoteResponse>(quoteUrl, {
          params: {
            inputMint: solMint,
            outputMint: tokenMint,
            amount: config.swap.amount,
            slippageBps: config.swap.slippageBps,
          },
          timeout: config.tx.get_timeout,
        });

        if (!quoteResponse.data) return null;

        // Serialize the quote into a swap transaction that can be submitted on chain
        const swapTransaction = await axios.post<SerializedQuoteResponse>(
          swapUrl,
          JSON.stringify({
            quoteResponse: quoteResponse.data,
            userPublicKey: myWallet.publicKey.toString(),
            wrapAndUnwrapSol: true,
            dynamicSlippage: {
              maxBps: 300,
            },
            prioritizationFeeLamports: {
              priorityLevelWithMaxLamports: {
                maxLamports: config.swap.prio_fee_max_lamports,
                priorityLevel: config.swap.prio_level,
              },
            },
          }),
          {
            headers: {
              "Content-Type": "application/json",
            },
            timeout: config.tx.get_timeout,
          }
        );

        if (!swapTransaction.data) return null;

        // deserialize the transaction
        const swapTransactionBuf = Buffer.from(swapTransaction.data.swapTransaction, "base64");
        const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

        // sign the transaction
        transaction.sign([myWallet.payer]);

        // Execute the transaction
        const rawTransaction = transaction.serialize();
        const txid = await connection.sendRawTransaction(rawTransaction, {
          skipPreflight: true,
          maxRetries: 2,
        });

        // Return null when no tx was returned
        if (!txid) return null;

        // Fetch the current status of a transaction signature
        const latestBlockHash = await connection.getLatestBlockhash();
        const conf = await connection.confirmTransaction({
          blockhash: latestBlockHash.blockhash,
          lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
          signature: txid,
        });

        // Return null when an error occurred when confirming the transaction
        if (conf.value.err) return null;

        return txid;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 400) {
          const errorData = error.response.data as ErrorResponse;
          if (errorData.response?.data.errorCode === "TOKEN_NOT_TRADABLE") {
            retryCount++;
            await new Promise((resolve) => setTimeout(resolve, config.swap.token_not_tradable_400_error_delay));
            continue;
          }
        }

        console.error("Error while requesting a new swap quote:", error instanceof Error ? error.message : String(error));
        if (config.swap.verbose_log) {
          console.log("Verbose Error Message:");
          if (axios.isAxiosError(error) && error.response) {
            console.error("Error Status:", error.response.status);
            console.error("Error Status Text:", error.response.statusText);
            console.error("Error Data:", error.response.data);
            console.error("Error Headers:", error.response.headers);
          } else if (axios.isAxiosError(error) && error.request) {
            console.error("No Response:", error.request);
          } else {
            console.error("Error Message:", String(error));
          }
        }
        return null;
      }
    }

    console.log("All attempts to fetch swap quote failed");
    return null;
  } catch (error: unknown) {
    console.error("Error while signing and sending the transaction:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function getRugCheckConfirmed(
  tokenMint: string,
  tokenName?: string,
  tokenCreator?: string,
  tokenSupply?: string,
  lpAmount?: string,
  lpProvider?: string
): Promise<boolean> {
  try {
    // If only tokenMint is provided, use the old RugCheck API method
    if (!tokenName && !tokenCreator) {
      const rugResponse = await axios.get<RugResponseExtended>(
        "https://api.rugcheck.xyz/v1/tokens/" + tokenMint + "/report",
        { timeout: config.tx.get_timeout }
      );

      if (!rugResponse.data) return false;

      // Show simulation mode notice
      if (config.rug_check.simulation_mode) {
        console.log("\n🔬 SIMULATION MODE: No actual swaps will be made");
      }

      // Extract information
      const tokenReport = rugResponse.data;
      const creator = tokenReport.creator || tokenMint;
      const mintAuthority = tokenReport.token.mintAuthority;
      const freezeAuthority = tokenReport.token.freezeAuthority;
      const isInitialized = tokenReport.token.isInitialized;
      const name = tokenReport.tokenMeta.name;
      const symbol = tokenReport.tokenMeta.symbol;
      const mutable = tokenReport.tokenMeta.mutable;
      const topHolders = tokenReport.topHolders;
      const marketsLength = tokenReport.markets?.length || 0;
      const totalLPProviders = tokenReport.totalLPProviders;
      const totalMarketLiquidity = tokenReport.totalMarketLiquidity;
      const isRugged = tokenReport.rugged;
      const rugScore = tokenReport.score;

      // Debug token metadata
      if (config.rug_check.verbose_log) {
        console.log("\n🔍 Token Metadata Debug:");
        console.log("- Token Name:", name);
        console.log("- Token Symbol:", symbol);
        console.log("- Token Creator:", creator);
      }

      // Set conditions
      const conditions = [
        {
          check: !config.rug_check.allow_mint_authority && mintAuthority !== null,
          message: "🚫 Mint authority should be null",
        },
        {
          check: !config.rug_check.allow_not_initialized && !isInitialized,
          message: "🚫 Token is not initialized",
        },
        {
          check: !config.rug_check.allow_freeze_authority && freezeAuthority !== null,
          message: "🚫 Freeze authority should be null",
        },
        {
          check: !config.rug_check.allow_mutable && mutable !== false,
          message: "🚫 Mutable should be false",
        },
        {
          check: !config.rug_check.allow_insider_topholders && topHolders.some((holder) => holder.insider),
          message: "🚫 Insider accounts should not be part of the top holders",
        },
        {
          check: topHolders.some((holder) => holder.pct > config.rug_check.max_alowed_pct_topholders),
          message: "🚫 An individual top holder cannot hold more than the allowed percentage of the total supply",
        },
        {
          check: totalLPProviders < config.rug_check.min_total_lp_providers,
          message: "🚫 Not enough LP Providers",
        },
        {
          check: marketsLength < config.rug_check.min_total_markets,
          message: "🚫 Not enough Markets",
        },
        {
          check: totalMarketLiquidity < config.rug_check.min_total_market_Liquidity,
          message: "🚫 Not enough Market Liquidity",
        },
        {
          check: !config.rug_check.allow_rugged && isRugged,
          message: "🚫 Token is rugged",
        },
        {
          check: config.rug_check.block_symbols.includes(symbol),
          message: "🚫 Symbol is blocked",
        },
        {
          check: config.rug_check.block_names.includes(name),
          message: "🚫 Name is blocked",
        },
        {
          check: rugScore > config.rug_check.max_score && config.rug_check.max_score !== 0,
          message: "🚫 Rug score too high",
        },
      ];

      // Check for duplicate tokens
      if (config.rug_check.block_returning_token_names || config.rug_check.block_returning_token_creators) {
        const duplicate = await selectTokenByNameAndCreator(name, creator);
        if (duplicate.length > 0) {
          if (config.rug_check.block_returning_token_names && duplicate.some((token) => token.name === name)) {
            console.log("🚫 Token with this name was already created");
            return false;
          }
          if (config.rug_check.block_returning_token_creators && duplicate.some((token) => token.creator === creator)) {
            console.log("🚫 Token from this creator was already created");
            return false;
          }
        }
      }

      // Store token information
      const newToken: NewTokenRecord = {
        time: Date.now(),
        mint: tokenMint,
        name,
        creator,
      };
      await insertNewToken(newToken);

      // Validate conditions
      for (const condition of conditions) {
        if (condition.check) {
          console.log(condition.message);
          return false;
        }
      }

      return true;
    }

    // New method with provided parameters
    console.log("\n🔍 Starting Rug Check Analysis...");
    
    // Debug log configuration if enabled
    if (config.rug_check.verbose_log) {
      console.log({
        tokenMint,
        tokenName,
        tokenCreator,
        tokenSupply: formatNumber(tokenSupply || "0"),
        lpAmount: formatNumber(lpAmount || "0"),
        lpProvider
      });
    }

    // Check if token is already tracked
    const existingToken = await selectTokenByMint(tokenMint);
    if (existingToken) {
      console.log("✅ Token already tracked and verified");
      return true;
    }

    // Check if similar token exists by name and creator
    if (tokenName && tokenCreator) {
      const similarToken = await selectTokenByNameAndCreator(tokenName, tokenCreator);
      if (similarToken && config.rug_check.block_similar_tokens) {
        console.log("⚠️ Similar token found - potential duplicate or relaunch");
        console.log("❌ Blocked by similar token check");
        return false;
      }
    }

    // Validate token supply
    if (tokenSupply) {
      const supplyBigInt = BigInt(tokenSupply);
      if (supplyBigInt <= 0n) {
        console.log("❌ Invalid token supply");
        return false;
      }

      // Calculate and validate LP ratio
      if (lpAmount) {
        const lpBigInt = BigInt(lpAmount);
        const lpRatio = Number(lpBigInt * 10000n / supplyBigInt) / 100;
        
        console.log(`\n📊 LP Analysis:`);
        console.log(`- Total Supply: ${formatNumber(tokenSupply)}`);
        console.log(`- LP Amount: ${formatNumber(lpAmount)}`);
        console.log(`- LP Ratio: ${lpRatio}%`);

        if (lpRatio < config.rug_check.min_lp_ratio) {
          console.log(`❌ LP ratio too low (${lpRatio}% < ${config.rug_check.min_lp_ratio}%)`);
          return false;
        }
      }
    }

    // Store token information if all checks pass
    if (tokenName && tokenCreator) {
      const newToken: NewTokenRecord = {
        time: Date.now(),
        mint: tokenMint,
        name: tokenName,
        creator: tokenCreator,
      };
      await insertNewToken(newToken);

      // Create a holding record
      const newHolding: HoldingRecord = {
        Time: Date.now(),
        Token: tokenMint,
        TokenName: tokenName,
        Balance: 0,
        SolPaid: 0,
        SolFeePaid: 0,
        SolPaidUSDC: 0,
        SolFeePaidUSDC: 0,
        PerTokenPaidUSDC: 0,
        Slot: 0,
        Program: "N/A",
      };
      await insertHolding(newHolding);
    }
    
    console.log("✅ All rug checks passed successfully");
    return true;

  } catch (error: unknown) {
    console.log("⛔ Error during rug check:", error instanceof Error ? error.message : String(error));
    return false;
  }
}

export async function fetchAndSaveSwapDetails(tx: string): Promise<boolean> {
  const txUrl = process.env.HELIUS_HTTPS_URI_TX || "";
  const priceUrl = process.env.JUP_HTTPS_PRICE_URI || "";

  try {
    const response = await axios.post<HeliusTransactionResponse>(
      txUrl,
      { transactions: [tx] },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: config.tx.get_timeout,
      }
    );

    // Verify if we received tx response data
    if (!response.data || !Array.isArray(response.data.transactions) || response.data.transactions.length === 0) {
      console.log("⛔ Could not fetch swap details: No response received from API.");
      return false;
    }

    // Safely access the event information
    const transactions = response.data.transactions;
    const swapTransactionData: SwapEventDetailsResponse = {
      programInfo: transactions[0]?.events.swap.innerSwaps[0].programInfo,
      tokenInputs: transactions[0]?.events.swap.innerSwaps[0].tokenInputs,
      tokenOutputs: transactions[0]?.events.swap.innerSwaps[0].tokenOutputs,
      fee: transactions[0]?.fee,
      slot: transactions[0]?.slot,
      timestamp: transactions[0]?.timestamp,
      description: transactions[0]?.description,
    };

    // Get latest Sol Price
    const solMint = config.liquidity_pool.wsol_pc_mint;
    const priceResponse = await axios.get<JupiterPriceResponse>(priceUrl, {
      params: {
        ids: solMint,
      },
      timeout: config.tx.get_timeout,
    });

    // Verify if we received the price response data
    if (!priceResponse.data.data[solMint]?.price) return false;

    // Calculate estimated price paid in sol
    const solUsdcPrice = priceResponse.data.data[solMint].price;
    const solPaidUsdc = swapTransactionData.tokenInputs[0].tokenAmount * solUsdcPrice;
    const solFeePaidUsdc = (swapTransactionData.fee / 1_000_000_000) * solUsdcPrice;
    const perTokenUsdcPrice = solPaidUsdc / swapTransactionData.tokenOutputs[0].tokenAmount;

    // Get token meta data
    let tokenName = "N/A";
    const tokenData = await selectTokenByMint(swapTransactionData.tokenOutputs[0].mint);
    if (tokenData && tokenData.length > 0) {
      tokenName = tokenData[0].name;
    }

    // Add holding to db
    const newHolding: HoldingRecord = {
      Time: swapTransactionData.timestamp,
      Token: swapTransactionData.tokenOutputs[0].mint,
      TokenName: tokenName,
      Balance: swapTransactionData.tokenOutputs[0].tokenAmount,
      SolPaid: swapTransactionData.tokenInputs[0].tokenAmount,
      SolFeePaid: swapTransactionData.fee,
      SolPaidUSDC: solPaidUsdc,
      SolFeePaidUSDC: solFeePaidUsdc,
      PerTokenPaidUSDC: perTokenUsdcPrice,
      Slot: swapTransactionData.slot,
      Program: swapTransactionData.programInfo ? swapTransactionData.programInfo.source : "N/A",
    };

    await insertHolding(newHolding);
    return true;
  } catch (error: unknown) {
    console.error("Error during request:", error instanceof Error ? error.message : String(error));
    return false;
  }
}

export async function createSellTransaction(solMint: string, tokenMint: string, amount: string): Promise<string | null | "TOKEN_ALREADY_SOLD"> {
  const quoteUrl = process.env.JUP_HTTPS_QUOTE_URI || "";
  const swapUrl = process.env.JUP_HTTPS_SWAP_URI || "";
  const rpcUrl = process.env.HELIUS_HTTPS_URI || "";
  const myWallet = new Wallet(Keypair.fromSecretKey(bs58.decode(process.env.PRIV_KEY_WALLET || "")));
  const connection = new Connection(rpcUrl);

  try {
    // Check token balance using the new utility
    const { balance, accounts, details } = await checkTokenBalance(
      connection,
      myWallet.publicKey,
      tokenMint
    );

    // Check if token exists with balance
    if (balance <= 0n) {
      console.log(`⚠️ Token ${tokenMint} has zero balance across ${accounts} accounts - Already sold elsewhere`);
      await removeHolding(tokenMint);
      return "TOKEN_ALREADY_SOLD";
    }

    // If we have detailed balance info, verify the amount to sell
    if (details && config.swap.verbose_log) {
      const totalUiAmount = details.reduce((sum, acc) => sum + acc.uiAmount, 0);
      console.log(`\n💰 Selling Details:`);
      console.log(`- Amount to sell: ${amount}`);
      console.log(`- Available balance: ${totalUiAmount}`);
    }

    // Request a quote in order to swap token for SOL
    const quoteResponse = await axios.get<QuoteResponse>(quoteUrl, {
      params: {
        inputMint: tokenMint,
        outputMint: solMint,
        amount: amount,
        slippageBps: config.sell.slippageBps,
      },
      timeout: config.tx.get_timeout,
    });

    if (!quoteResponse.data) return null;

    // Serialize the quote into a swap transaction that can be submitted on chain
    const swapTransaction = await axios.post<SerializedQuoteResponse>(
      swapUrl,
      JSON.stringify({
        quoteResponse: quoteResponse.data,
        userPublicKey: myWallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
        dynamicSlippage: {
          maxBps: 300,
        },
        prioritizationFeeLamports: {
          priorityLevelWithMaxLamports: {
            maxLamports: config.sell.prio_fee_max_lamports,
            priorityLevel: config.sell.prio_level,
          },
        },
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: config.tx.get_timeout,
      }
    );

    if (!swapTransaction.data) return null;

    // deserialize the transaction
    const swapTransactionBuf = Buffer.from(swapTransaction.data.swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    // sign the transaction
    transaction.sign([myWallet.payer]);

    // Execute the transaction
    const rawTransaction = transaction.serialize();
    const txid = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: true,
      maxRetries: 2,
    });

    // Return null when no tx was returned
    if (!txid) return null;

    // Fetch the current status of a transaction signature
    const latestBlockHash = await connection.getLatestBlockhash();
    const conf = await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: txid,
    });

    // Return null when an error occurred when confirming the transaction
    if (conf.value.err) return null;

    return txid;
  } catch (error: unknown) {
    console.error("Error while signing and sending the transaction:", error instanceof Error ? error.message : String(error));
    if (config.swap.verbose_log) {
      console.log("Verbose Error Message:");
      if (axios.isAxiosError(error) && error.response) {
        console.error("Error Status:", error.response.status);
        console.error("Error Status Text:", error.response.statusText);
        console.error("Error Data:", error.response.data);
        console.error("Error Headers:", error.response.headers);
      } else if (axios.isAxiosError(error) && error.request) {
        console.error("No Response:", error.request);
      } else {
        console.error("Error Message:", String(error));
      }
    }
    return null;
  }
}
