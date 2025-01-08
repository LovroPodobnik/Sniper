#!/bin/bash

# Load environment variables
source .env

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to test URL accessibility
test_url() {
    local url=$1
    local name=$2
    if curl -s "$url" > /dev/null; then
        echo -e "${GREEN}✅ $name is accessible${NC}"
        return 0
    else
        echo -e "${RED}❌ $name is not accessible${NC}"
        return 1
    fi
}

# Test PRIV_KEY_WALLET
echo "Testing PRIV_KEY_WALLET..."
if [ -z "$PRIV_KEY_WALLET" ]; then
    echo -e "${RED}❌ PRIV_KEY_WALLET is not set${NC}"
elif [ ${#PRIV_KEY_WALLET} -eq 87 ] || [ ${#PRIV_KEY_WALLET} -eq 88 ]; then
    echo -e "${GREEN}✅ PRIV_KEY_WALLET length is correct (${#PRIV_KEY_WALLET} characters)${NC}"
else
    echo -e "${RED}❌ PRIV_KEY_WALLET length is incorrect (${#PRIV_KEY_WALLET} characters, should be 87 or 88)${NC}"
fi

# Test Helius endpoints
echo -e "\nTesting Helius endpoints..."
if [[ $HELIUS_HTTPS_URI == https://* ]]; then
    echo -e "${GREEN}✅ HELIUS_HTTPS_URI format is correct${NC}"
    test_url "$HELIUS_HTTPS_URI" "HELIUS_HTTPS_URI"
else
    echo -e "${RED}❌ HELIUS_HTTPS_URI should start with https://${NC}"
fi

if [[ $HELIUS_WSS_URI == wss://* ]]; then
    echo -e "${GREEN}✅ HELIUS_WSS_URI format is correct${NC}"
else
    echo -e "${RED}❌ HELIUS_WSS_URI should start with wss://${NC}"
fi

if [[ $HELIUS_HTTPS_URI_TX == https://* ]]; then
    echo -e "${GREEN}✅ HELIUS_HTTPS_URI_TX format is correct${NC}"
    test_url "$HELIUS_HTTPS_URI_TX" "HELIUS_HTTPS_URI_TX"
else
    echo -e "${RED}❌ HELIUS_HTTPS_URI_TX should start with https://${NC}"
fi

# Test Jupiter endpoints
echo -e "\nTesting Jupiter endpoints..."
test_url "$JUP_HTTPS_QUOTE_URI" "JUP_HTTPS_QUOTE_URI"
test_url "$JUP_HTTPS_SWAP_URI" "JUP_HTTPS_SWAP_URI"
test_url "$JUP_HTTPS_PRICE_URI" "JUP_HTTPS_PRICE_URI"

# Summary
echo -e "\nEnvironment Variables Summary:"
echo "PRIV_KEY_WALLET: ${#PRIV_KEY_WALLET} characters"
echo "HELIUS_HTTPS_URI: ${HELIUS_HTTPS_URI}"
echo "HELIUS_WSS_URI: ${HELIUS_WSS_URI}"
echo "HELIUS_HTTPS_URI_TX: ${HELIUS_HTTPS_URI_TX}"
echo "JUP_HTTPS_QUOTE_URI: ${JUP_HTTPS_QUOTE_URI}"
echo "JUP_HTTPS_SWAP_URI: ${JUP_HTTPS_SWAP_URI}"
echo "JUP_HTTPS_PRICE_URI: ${JUP_HTTPS_PRICE_URI}" 