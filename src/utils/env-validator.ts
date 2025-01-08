import dotenv from 'dotenv';

export interface EnvConfig {
    PRIV_KEY_WALLET: string;
    HELIUS_HTTPS_URI: string;
    HELIUS_WSS_URI: string;
    HELIUS_HTTPS_URI_TX: string;
    JUP_HTTPS_QUOTE_URI: string;
    JUP_HTTPS_SWAP_URI: string;
    JUP_HTTPS_PRICE_URI: string;
}

export function validateEnv(): EnvConfig {
    // Load environment variables
    dotenv.config();

    const requiredEnvVars = [
        'PRIV_KEY_WALLET',
        'HELIUS_HTTPS_URI',
        'HELIUS_WSS_URI',
        'HELIUS_HTTPS_URI_TX',
        'JUP_HTTPS_QUOTE_URI',
        'JUP_HTTPS_SWAP_URI',
        'JUP_HTTPS_PRICE_URI'
    ] as const;

    const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Validate PRIV_KEY_WALLET
    const keyLength = process.env.PRIV_KEY_WALLET!.length;
    if (keyLength !== 87 && keyLength !== 88) {
        throw new Error('PRIV_KEY_WALLET must be 87 or 88 characters long (got ' + keyLength + ')');
    }

    // Validate URL formats
    if (!process.env.HELIUS_HTTPS_URI!.startsWith('https://')) {
        throw new Error('HELIUS_HTTPS_URI must start with https://');
    }
    if (!process.env.HELIUS_WSS_URI!.startsWith('wss://')) {
        throw new Error('HELIUS_WSS_URI must start with wss://');
    }
    if (!process.env.HELIUS_HTTPS_URI_TX!.startsWith('https://')) {
        throw new Error('HELIUS_HTTPS_URI_TX must start with https://');
    }

    // Return typed environment variables
    return {
        PRIV_KEY_WALLET: process.env.PRIV_KEY_WALLET!,
        HELIUS_HTTPS_URI: process.env.HELIUS_HTTPS_URI!,
        HELIUS_WSS_URI: process.env.HELIUS_WSS_URI!,
        HELIUS_HTTPS_URI_TX: process.env.HELIUS_HTTPS_URI_TX!,
        JUP_HTTPS_QUOTE_URI: process.env.JUP_HTTPS_QUOTE_URI!,
        JUP_HTTPS_SWAP_URI: process.env.JUP_HTTPS_SWAP_URI!,
        JUP_HTTPS_PRICE_URI: process.env.JUP_HTTPS_PRICE_URI!
    };
} 