import { Connection, PublicKey } from "@solana/web3.js";
import { config } from "../config";

interface TokenBalanceResult {
    balance: bigint;
    accounts: number;
    details?: {
        address: string;
        balance: string;
        uiAmount: number;
    }[];
}

/**
 * Checks token balance across all accounts for a given wallet
 * @param connection Solana RPC connection
 * @param wallet Wallet public key
 * @param tokenMint Token mint address
 * @returns Object containing total balance and number of accounts
 */
export async function checkTokenBalance(
    connection: Connection,
    wallet: PublicKey,
    tokenMint: string
): Promise<TokenBalanceResult> {
    try {
        // Get all token accounts
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            wallet,
            { mint: new PublicKey(tokenMint) }
        );

        // Calculate total balance across all accounts
        const totalBalance = tokenAccounts.value.reduce((sum, account) => {
            const tokenAmount = account.account.data.parsed.info.tokenAmount.amount;
            return sum + BigInt(tokenAmount);
        }, BigInt(0));

        // Prepare detailed account information for logging
        const accountDetails = tokenAccounts.value.map(acc => ({
            address: acc.pubkey.toString(),
            balance: acc.account.data.parsed.info.tokenAmount.amount,
            uiAmount: acc.account.data.parsed.info.tokenAmount.uiAmount
        }));

        if (config.swap.verbose_log) {
            console.log("\n🔍 Token Balance Check:");
            console.log(`- Token Mint: ${tokenMint}`);
            console.log(`- Number of accounts: ${tokenAccounts.value.length}`);
            console.log(`- Total balance: ${totalBalance.toString()}`);
            
            accountDetails.forEach((acc, idx) => {
                console.log(`\n- Account ${idx + 1}:`);
                console.log(`  • Address: ${acc.address}`);
                console.log(`  • Raw Balance: ${acc.balance}`);
                console.log(`  • UI Amount: ${acc.uiAmount}`);
            });
        }

        return {
            balance: totalBalance,
            accounts: tokenAccounts.value.length,
            details: config.swap.verbose_log ? accountDetails : undefined
        };
    } catch (error) {
        console.error("Error checking token balance:", error);
        throw error;
    }
} 