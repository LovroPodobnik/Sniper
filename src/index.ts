import WebSocket from "ws"; // Node.js websocket library
import dotenv from "dotenv"; // zero-dependency module that loads environment variables from a .env
import { WebSocketRequest } from "./types"; // Typescript Types for type safety
import { config } from "./config"; // Configuration parameters for our bot
import { fetchTransactionDetails, createSwapTransaction, getRugCheckConfirmed, fetchAndSaveSwapDetails } from "./transactions";
import { validateEnv } from "./utils/env-validator";

// Load environment variables from the .env file
dotenv.config();

// Validate environment variables before starting
const env = validateEnv();
let activeTransactions = 0;
const MAX_CONCURRENT = config.tx.concurrent_transactions;

// Function used to open our websocket connection
function sendSubscribeRequest(ws: WebSocket): void {
  const request: WebSocketRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "logsSubscribe",
    params: [
      {
        mentions: [config.liquidity_pool.radiyum_program_id],
      },
      {
        commitment: "confirmed"
      },
    ],
  };
  console.log("📤 Sending subscription request:", JSON.stringify(request, null, 2));
  ws.send(JSON.stringify(request));
}

// Function used to close other connections

// Function used to handle the transaction once a new pool creation is found
async function processTransaction(signature: string): Promise<void> {
  // Output logs
  console.log("=============================================");
  console.log("🔎 New Liquidity Pool found.");
  console.log("🔃 Fetching transaction details ...");

  // Fetch the transaction details
  const data = await fetchTransactionDetails(signature);
  if (!data) {
    console.log("⛔ Transaction aborted. No data returned.");
    console.log("🟢 Resuming looking for new tokens...\n");
    return;
  }

  // Ensure required data is available
  if (!data.solMint || !data.tokenMint) return;

  // Check rug check
  const isRugCheckPassed = await getRugCheckConfirmed(data.tokenMint);
  if (!isRugCheckPassed) {
    console.log("🚫 Rug Check not passed! Transaction aborted.");
    console.log("🟢 Resuming looking for new tokens...\n");
    return;
  }

  // Handle ignored tokens
  if (data.tokenMint.trim().toLowerCase().endsWith("pump") && config.rug_check.ignore_pump_fun) {
    // Check if ignored
    console.log("🚫 Transaction skipped. Ignoring Pump.fun.");
    console.log("🟢 Resuming looking for new tokens..\n");
    return;
  }

  // Ouput logs
  console.log("Token found");
  console.log("👽 GMGN: https://gmgn.ai/sol/token/" + data.tokenMint);
  console.log("😈 BullX: https://neo.bullx.io/terminal?chainId=1399811149&address=" + data.tokenMint);

  // Check if simulation mode is enabled
  if (config.rug_check.simulation_mode) {
    console.log("👀 Token not swapped. Simulation mode is enabled.");
    console.log("🟢 Resuming looking for new tokens..\n");
    return;
  }

  // Add initial delay before first buy
  await new Promise((resolve) => setTimeout(resolve, config.tx.swap_tx_initial_delay));

  // Create Swap transaction
  const tx = await createSwapTransaction(data.solMint, data.tokenMint);
  if (!tx) {
    console.log("⛔ Transaction aborted. No valid id returned.");
    console.log("🟢 Resuming looking for new tokens...\n");
    return;
  }

  // Output logs
  console.log("✅ Swap quote recieved.");
  console.log("🚀 Swapping SOL for Token.");
  console.log("Swap Transaction: ", "https://solscan.io/tx/" + tx);

  // Fetch and store the transaction for tracking purposes
  const saveConfirmation = await fetchAndSaveSwapDetails(tx);
  if (!saveConfirmation) {
    console.log("❌ Warning: Transaction not saved for tracking! Track Manually!");
  }
}

let init = false;
async function websocketHandler(): Promise<void> {
  // Create a WebSocket connection
  let ws: WebSocket | null = new WebSocket(env.HELIUS_WSS_URI);
  if (!init) console.clear();

  // @TODO, test with hosting our app on a Cloud instance closer to the RPC nodes physical location for minimal latency
  // @TODO, test with different RPC and API nodes (free and paid) from quicknode and shyft to test speed

  // Send subscription to the websocket once the connection is open
  ws.on("open", () => {
    console.log("\n🔄 WebSocket connection opened, sending subscription request...");
    // Subscribe
    if (ws) {
      sendSubscribeRequest(ws);
      console.log("📨 Subscription request sent");
    }
    console.log("🔓 WebSocket is open and listening.");
    init = true;
  });

  // Logic for the message event for the .on event listener
  ws.on("message", async (data: WebSocket.Data) => {
    try {
        const jsonString = data.toString();
        const parsedData = JSON.parse(jsonString);
        
        // Handle subscription response
        if (parsedData.result !== undefined && !parsedData.error) {
            console.log("✅ Subscription confirmed");
            return;
        }

        // Only log RPC errors for debugging
        if (parsedData.error) {
            console.error("🚫 RPC Error:", parsedData.error);
            return;
        }

        // Safely access the nested structure
        const logs = parsedData?.params?.result?.value?.logs;
        const signature = parsedData?.params?.result?.value?.signature;

        // Skip if no logs or signature
        if (!Array.isArray(logs) || !signature) return;

        // Check if this is a pool creation
        const containsCreate = logs.some((log: string) => 
            typeof log === "string" && 
            log.includes("Program log: initialize2: InitializeInstruction2")
        );
        
        // Only proceed if it's a pool creation
        if (!containsCreate) return;

        // Log pool creation
        console.log('🎯 New Pool Creation Detected:', {
            signature,
            solscanLink: `https://solscan.io/tx/${signature}`,
        });

        // Verify if we have reached the max concurrent transactions
        if (activeTransactions >= MAX_CONCURRENT) {
            console.log("⏳ Max concurrent transactions reached, skipping...");
            return;
        }

        // Add additional concurrent transaction
        activeTransactions++;

        // Process transaction asynchronously
        processTransaction(signature)
            .catch((error) => {
                console.error("Error processing transaction:", error);
            })
            .finally(() => {
                activeTransactions--;
            });
    } catch (error) {
        console.error("💥 Error processing message:", {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
  });

  ws.on("error", (err: Error) => {
    console.error("�� WebSocket error:", err);
  });

  ws.on("close", () => {
    console.log("📴 WebSocket connection closed, cleaning up...");
    if (ws) {
      ws.removeAllListeners();
      ws = null;
    }
    console.log("🔄 Attempting to reconnect in 5 seconds...");
    setTimeout(websocketHandler, 5000);
  });
}

websocketHandler();
