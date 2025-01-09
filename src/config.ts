import { RugCheckConfig } from "./types";

export const config = {
  liquidity_pool: {
    radiyum_program_id: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    wsol_pc_mint: "So11111111111111111111111111111111111111112",
  },
  tx: {
    fetch_tx_max_retries: 10,
    fetch_tx_initial_delay: 3000, // Initial delay before fetching LP creation transaction details (3 seconds)
    swap_tx_initial_delay: 1000, // Initial delay before first buy (1 second)
    get_timeout: 10000, // Timeout for API requests
    concurrent_transactions: 1, // Number of simultaneous transactions
    retry_delay: 500, // Delay between retries (0.5 seconds)
  },
  swap: {
    verbose_log: true,
    prio_fee_max_lamports: 1000000, // 0.001 SOL
    prio_level: "veryHigh", // If you want to land transaction fast, set this to use `veryHigh`. You will pay on average higher priority fee.
    amount: "10000000", //0.01 SOL
    slippageBps: "200", // 2%
    db_name_tracker_holdings: "src/tracker/holdings.db", // Sqlite Database location
    token_not_tradable_400_error_retries: 5, // How many times should the bot try to get a quote if the token is not tradable yet
    token_not_tradable_400_error_delay: 2000, // How many seconds should the bot wait before retrying to get a quote again
  },
  sell: {
    prio_fee_max_lamports: 1000000, // 0.001 SOL
    prio_level: "veryHigh", // If you want to land transaction fast, set this to use `veryHigh`. You will pay on average higher priority fee.
    slippageBps: "200", // 2%
    auto_sell: false, // If set to true, stop loss and take profit triggers automatically when set.
    stop_loss_percent: 5,
    take_profit_percent: 50,
    track_public_wallet: "", // If set an additional log line will be shown with a link to track your wallet
  },
  rug_check: {
    verbose_log: true,
    simulation_mode: true,
    allow_mint_authority: false,
    allow_not_initialized: false,
    allow_freeze_authority: false,
    allow_rugged: false,
    allow_mutable: false,
    allow_insider_topholders: false,
    block_similar_tokens: true,
    block_returning_token_names: true,
    block_returning_token_creators: true,
    block_symbols: [],
    block_names: [],
    max_alowed_pct_topholders: 10,
    min_total_lp_providers: 1,
    min_total_markets: 1,
    min_total_market_Liquidity: 1,
    max_score: 50,
    min_lp_ratio: 5,
    legacy_not_allowed: [],
    ignore_pump_fun: true, // Whether to ignore tokens with "pump" in their name
  } as RugCheckConfig,
};
