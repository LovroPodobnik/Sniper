# Changes Made to Solana Token Sniper Bot

## Index.ts Modifications

### WebSocket Message Handling Improvements
- Added more detailed logging for WebSocket connection status
- Added console logs to indicate when subscription request is sent
- Modified message event listener to filter and process only relevant pool creation events
- Added structured logging for new pool detections with Solscan links

### Code Structure Changes
1. **Variable Declaration Fix**
   - Moved `logs` and `signature` variable declarations before their usage
   - Removed redundant `console.log(logs)` statement
   - Fixed block-scoped variable declaration issue

2. **Transaction Processing**
   - Enhanced error handling in transaction processing
   - Added validation for program IDs
   - Improved transaction logging with AMM type information
   - Added structured error messages with timestamps

### Validation Improvements
- Added environment variable validation
- Modified private key validation to accept both 87 and 88 character keys (Phantom wallet compatibility)
- Added checks for RPC errors and invalid transactions

### Performance Optimizations
- Added unsubscribe functionality before new subscriptions
- Implemented better connection management
- Added concurrent transaction handling with limits

## Configuration Updates
- Set simulation mode for testing without actual transactions
- Configured detailed logging for debugging purposes
- Added rug check parameters for better security

## Why These Changes Were Made
1. **Stability**: Better error handling and connection management to prevent crashes
2. **Security**: Enhanced validation to prevent processing unwanted transactions
3. **Monitoring**: Improved logging for better debugging and transaction tracking
4. **Efficiency**: Better memory management with proper WebSocket cleanup
5. **Compatibility**: Added support for Phantom wallet private keys

## Future Considerations
- Consider adding more detailed transaction logging
- Implement additional security checks for new pools
- Add more sophisticated error recovery mechanisms
- Consider implementing rate limiting for RPC calls

## Testing Notes
- All changes have been tested in simulation mode
- Verified WebSocket connection handling
- Confirmed proper transaction validation
- Tested environment variable validation 

## Rug Check Configuration Documentation

The Rug Check tool is designed to analyze the safety and legitimacy of a cryptocurrency token. The settings in this configuration are deliberately set to strict and unrealistic values to encourage users to thoroughly research and customize the parameters based on their specific needs and strategy.

### Why such a strict approach?
We have chosen a strict approach in our rug check configuration to promote ethical practices and informed decision-making within the community. By setting unrealistic default values, we aim to encourage users to conduct thorough research and exercise caution when evaluating tokens. This helps protect users from potential scams and fosters a safer trading environment.

Additionally, this approach ensures that if users choose to adjust the parameters for unethical purposes, they do so by their own choice and responsibility. We do not endorse or support any misuse of this tool, and we stand firmly against fraudulent activities in the blockchain space. Our intention is to empower users with knowledge and safeguard them from malicious projects.

### Configuration Settings Explained

#### Basic Settings
- **verbose_log** (default: false)
  - Enables detailed logging for debugging purposes
  - Set to true for more information about token analysis process

- **simulation_mode** (default: true)
  - Runs the sniper in a simulated environment without executing real transactions
  - Recommended to keep enabled during testing

### Implementation Details
The simulation mode is configured in `src/config.ts` under the `rug_check` section:
```typescript
rug_check: {
    simulation_mode: true,  // Controls whether real transactions are executed
}
```

### How It Works
1. **Location**: Implemented in `src/index.ts` within the `processTransaction` function
2. **Check Point**: After token discovery but before swap transaction creation
3. **Code Flow**:
```typescript
// Check if simulation mode is enabled
if (config.rug_check.simulation_mode) {
    console.log("👀 Token not swapped. Simulation mode is enabled.");
    console.log("🟢 Resuming looking for new tokens..\n");
    return;
}
```

### Purpose
- **Testing**: Allows testing the bot's detection and validation logic without risking real funds
- **Development**: Helps in developing and debugging new features safely
- **Validation**: Verifies rug check and other security measures without executing trades

### Usage
1. **Development Mode**: Keep `true` while developing or testing new features
2. **Production Mode**: Set to `false` when ready to execute real transactions
3. **Testing Setup**: Use with other test parameters to verify full workflow

### Safety Notes
- Always start with simulation mode enabled when testing new configurations
- Verify all security checks pass before disabling simulation mode
- Double-check all parameters when switching to live trading

#### Dangerous Settings
These settings can pose significant risks if not configured properly. Strongly recommended to keep them set to false.

- **allow_mint_authority** (default: false)
  - Controls permission to create new tokens
  - Keep false to prevent unlimited token creation risk

- **allow_not_initialized** (default: false)
  - Verifies proper token account initialization
  - Keep false for legitimate token account validation

- **allow_freeze_authority** (default: false)
  - Controls ability to lock token transfers
  - Keep false to prevent fund freezing

- **allow_rugged** (default: false)
  - Controls acceptance of previously rugged tokens
  - Keep false to block known rugged tokens

#### Critical Settings
- **allow_mutable** (default: false)
  - Prevents post-creation token modifications
  - Keep false for immutable token metadata

- **block_returning_token_names** (default: true)
- **block_returning_token_creators** (default: true)
  - Prevents buying tokens with recently used creators or names
  - Protection against repeat scammers

- **block_symbols** (default: ["XXX"])
- **block_names** (default: ["XXX"])
  - Blocks specific token symbols/names
  - Customize based on known scam patterns

- **allow_insider_topholders** (default: false)
  - Controls insider account holdings
  - Keep false to prevent insider manipulation

- **max_allowed_pct_topholders** (default: 1)
  - Maximum percentage of token supply per holder
  - Includes LP unless excluded

- **exclude_lp_from_topholders** (default: false)
  - Controls whether LPs count as top holders
  - Consider token distribution strategy

#### Warning Settings
- **min_total_markets** (default: 999)
  - Minimum required market listings

- **min_total_lp_providers** (default: 999)
  - Minimum required liquidity providers

- **min_total_market_Liquidity** (default: 1,000,000)
  - Minimum total market liquidity requirement

#### Miscellaneous Settings
- **ignore_pump_fun** (default: true)
  - Ignores tokens from pump.fun platform

- **max_score** (default: 1)
  - Risk score threshold (lower = stricter)
  - Set to 0 to ignore scoring system

#### Legacy Risk Checks
Default blocked risks:
- Low Liquidity
- Single Holder Ownership
- High Holder Concentration
- Freeze Authority Still Enabled
- Large Amount of LP Unlocked
- Copycat Token
- Low Amount of LP Providers

For detailed API documentation and additional configuration options, refer to:
https://api.rugcheck.xyz/swagger/index.html#/Tokens/get_tokens__mint__report_summary

## Common Issues & Troubleshooting

### WebSocket 401 Unauthorized Error
If you encounter "WebSocket error: Error: Unexpected server response: 401", check:
1. Your Helius API key in `.env` file - make sure it's valid and not expired
2. Verify `HELIUS_WSS_URI` format in `.env`: should be `wss://rpc-devnet.helius.xyz/?api-key=YOUR-API-KEY`
3. Check if you've reached your API rate limits on Helius dashboard
4. Try regenerating your API key if the issue persists 

## Community Insights & Troubleshooting

### Transaction Speed and Timing
1. **Block Height Expiration**
   - Error: "Signature has expired: block height exceeded"
   - Cause: Transaction too slow to commit to the intended block
   - Solution: Consider adjusting priority levels and slippage settings

2. **Priority Levels**
   - Options available: "medium" (25%), "high" (50%), "veryHigh" (75%)
   - Configuration in `config.ts`: `prio_level: "veryHigh"`
   - Higher levels increase transaction success rate but cost more in fees

### Configuration Insights
1. **LP Provider Settings**
   - Default `min_total_lp_providers: 999` is intentionally strict
   - Real-world tokens typically have 1-2 LP providers initially
   - Users should adjust based on their risk tolerance

2. **Top Holders Configuration**
   - `max_allowed_pct_topholders: 1` may be too restrictive
   - New tokens often have holders with ~15% holdings
   - Consider adjusting based on market analysis
   - `exclude_lp_from_topholders: true` recommended for most cases

3. **Market Liquidity**
   - `min_total_market_Liquidity: 1,000,000` needs careful consideration
   - Value interpretation depends on token economics
   - Adjust based on target market segment

### Common Transaction Issues
1. **"Transaction aborted. No valid id returned"** can occur due to:
   - Failed swap quote reception
   - Serialization failure
   - Transaction signing/sending failure
   - Enable `config.swap.verbose_log: true` for detailed diagnostics

2. **SOL/WSOL Handling**
   - Bot automatically handles SOL wrapping/unwrapping
   - Configuration: `wrapAndUnwrapSol: true`
   - Amount setting in lamports: `amount: "10000000"` (0.01 SOL)

### Performance Optimization Tips
1. **Pool Creation Timing**
   - LP tokens often burned minutes after pool creation
   - Consider implementing delay mechanism for secondary checks
   - Balance between speed and validation

2. **Gas Fee Management**
   - Monitor and adjust priority fees based on network conditions
   - Consider transaction timing to minimize expired transactions
   - Use verbose logging to track transaction performance

### Testing and Development
1. **Initial Setup**
   - Start with simulation mode enabled
   - Test with small amounts when moving to live trading
   - Monitor rug check logs for validation insights

2. **Configuration Testing**
   - Use verbose logging for both swap and rug check operations
   - Monitor transaction success rates
   - Adjust parameters based on observed performance

For detailed API documentation and additional configuration options, refer to:
- Jupiter API: https://station.jup.ag/docs/apis/swap-api
- Rug Check API: https://api.rugcheck.xyz/swagger/index.html 

## Transaction Processing Details

### fetchTransactionDetails Function
Located in `src/transactions.ts`, this function is critical for processing new pool creations.

#### Implementation Overview
```typescript
export async function fetchTransactionDetails(signature: string): Promise<MintsDataReponse | null> {
    // Uses Helius API to fetch transaction details
    // Implements retry logic with exponential backoff
    // Returns token mint information for new pools
}
```

#### Key Features
1. **Initial Delay**
   - Waits for transaction confirmation
   - Default delay: `config.tx.fetch_tx_initial_delay` (3 seconds)
   - Configurable in `config.ts`

2. **Retry Mechanism**
   - Maximum retries: `config.tx.fetch_tx_max_retries` (10 attempts)
   - Exponential backoff: Delay increases with each retry
   - Maximum delay cap: 15 seconds

3. **Validation Steps**
   - Verifies response data existence
   - Checks for correct instruction format
   - Validates Raydium program ID
   - Confirms presence of token accounts

4. **Token Account Identification**
   - Identifies SOL and new token accounts
   - Validates against configured WSOL mint address
   - Returns structured data for further processing

#### Error Handling
1. **Retry Scenarios**
   - Empty response data
   - Missing transaction details
   - Invalid instruction format
   - Missing account information

2. **Error Messages**
   - Detailed logging of each attempt
   - Clear error descriptions
   - Retry countdown information

#### Usage in Transaction Flow
1. Called by `processTransaction` function when new pool is detected
2. Success leads to rug check verification
3. Failure triggers transaction abort with appropriate logging

#### Configuration Dependencies
```typescript
config.tx: {
    fetch_tx_max_retries: 10,
    fetch_tx_initial_delay: 3000,
    get_timeout: 10000
}
```

#### Common Issues and Solutions
1. **"Response data array is empty"**
   - Cause: Transaction not yet confirmed
   - Solution: Increase initial delay or max retries

2. **"No market maker instruction found"**
   - Cause: Invalid pool creation transaction
   - Solution: Verify transaction signature and program ID

3. **"Required accounts not found"**
   - Cause: Incomplete transaction data
   - Solution: Check transaction structure and retry logic

[... rest of the content remains unchanged ...] 