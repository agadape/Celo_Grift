# SawerLink Contracts

Foundry project for the on-chain registry behind SawerLink.

## Setup

```bash
# From repo root, install forge-std submodule (one-time)
git submodule update --init --recursive

# From contracts/, build
cd contracts
forge build

# Run tests
forge test -vvv

# Gas snapshot
forge snapshot
```

## Deploy

Copy `.env.example` to `.env` and fill in `PRIVATE_KEY`.

```bash
# Celo Sepolia (testnet)
forge script script/Deploy.s.sol \
  --rpc-url celo_sepolia \
  --broadcast \
  --verify

# Celo Mainnet
forge script script/Deploy.s.sol \
  --rpc-url celo \
  --broadcast \
  --verify
```

## Networks

| Network | Chain ID | RPC | Explorer |
|---|---|---|---|
| Celo Mainnet | 42220 | https://forno.celo.org | https://celoscan.io |
| Celo Sepolia | 11142220 | https://forno.celo-sepolia.celo-testnet.org | https://celo-sepolia.blockscout.com |
