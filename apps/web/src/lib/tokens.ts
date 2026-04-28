import {celo} from "viem/chains";
import {ACTIVE_CHAIN} from "./publicClient";
import type {Address} from "viem";

export interface CeloToken {
  symbol: string;
  address: Address | "native";
  decimals: number;
  feeCurrency?: Address; // set on stablecoins to pay gas in that token
}

export interface SourceToken {
  symbol: string;
  address: string; // "0x000...000" for native
  decimals: number;
}

const MAINNET_TOKENS: CeloToken[] = [
  {symbol: "CELO", address: "native", decimals: 18},
  {
    symbol: "cUSD",
    address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    decimals: 18,
    feeCurrency: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  },
  {
    symbol: "USDC",
    address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    decimals: 6,
  },
  {
    symbol: "USDT",
    address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5E",
    decimals: 6,
  },
];

const SEPOLIA_TOKENS: CeloToken[] = [
  {symbol: "CELO", address: "native", decimals: 18},
  {
    symbol: "cUSD",
    address: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
    decimals: 18,
    feeCurrency: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1",
  },
];

export const CELO_TOKENS: CeloToken[] =
  ACTIVE_CHAIN.id === celo.id ? MAINNET_TOKENS : SEPOLIA_TOKENS;

// Per-chain source tokens for cross-chain widget
export const SOURCE_CHAIN_TOKENS: Record<number, SourceToken[]> = {
  1: [
    {symbol: "ETH", address: "0x0000000000000000000000000000000000000000", decimals: 18},
    {symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6},
    {symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6},
    {symbol: "DAI", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18},
  ],
  137: [
    {symbol: "MATIC", address: "0x0000000000000000000000000000000000000000", decimals: 18},
    {symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6},
    {symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6},
  ],
  8453: [
    {symbol: "ETH", address: "0x0000000000000000000000000000000000000000", decimals: 18},
    {symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6},
  ],
  42161: [
    {symbol: "ETH", address: "0x0000000000000000000000000000000000000000", decimals: 18},
    {symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6},
    {symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6},
  ],
  10: [
    {symbol: "ETH", address: "0x0000000000000000000000000000000000000000", decimals: 18},
    {symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6},
    {symbol: "USDT", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6},
  ],
};

// Minimal ERC-20 ABI for transfer, approve, allowance, balanceOf
export const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      {name: "to", type: "address"},
      {name: "value", type: "uint256"},
    ],
    outputs: [{type: "bool"}],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      {name: "spender", type: "address"},
      {name: "value", type: "uint256"},
    ],
    outputs: [{type: "bool"}],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      {name: "owner", type: "address"},
      {name: "spender", type: "address"},
    ],
    outputs: [{type: "uint256"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{name: "account", type: "address"}],
    outputs: [{type: "uint256"}],
    stateMutability: "view",
  },
] as const;

// Public JSON-RPC endpoints for source chains (for allowance checks + approval waits)
export const SOURCE_CHAIN_RPCS: Record<number, string> = {
  1: "https://eth.public.blastapi.io",
  137: "https://polygon-bor-rpc.publicnode.com",
  8453: "https://base.public.blastapi.io",
  42161: "https://arbitrum-one.public.blastapi.io",
  10: "https://optimism.public.blastapi.io",
};

export function isNativeToken(address: string): boolean {
  return address === "0x0000000000000000000000000000000000000000";
}
