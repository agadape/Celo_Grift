import {keccak256, toBytes} from "viem";
import {celo, celoSepolia} from "viem/chains";
import {ACTIVE_CHAIN} from "./publicClient";

export const SAWER_REGISTRY_ABI = [
  {
    type: "function",
    name: "creatorsByHandle",
    inputs: [{name: "", type: "bytes32"}],
    outputs: [
      {name: "payoutAddress", type: "address"},
      {name: "handle", type: "string"},
      {name: "metadataURI", type: "string"},
      {name: "exists", type: "bool"},
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "registerCreator",
    inputs: [
      {name: "handle", type: "string"},
      {name: "metadataURI", type: "string"},
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateMetadata",
    inputs: [
      {name: "handle", type: "string"},
      {name: "newMetadataURI", type: "string"},
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "tip",
    inputs: [
      {name: "handle", type: "string"},
      {name: "token", type: "address"},
      {name: "amount", type: "uint256"},
      {name: "message", type: "string"},
      {name: "routeId", type: "bytes32"},
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "recordTip",
    inputs: [
      {name: "handle", type: "string"},
      {name: "token", type: "address"},
      {name: "amount", type: "uint256"},
      {name: "message", type: "string"},
      {name: "routeId", type: "bytes32"},
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "CreatorRegistered",
    inputs: [
      {name: "creator", type: "address", indexed: true},
      {name: "handleHash", type: "bytes32", indexed: true},
      {name: "handle", type: "string", indexed: false},
      {name: "metadataURI", type: "string", indexed: false},
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "MetadataUpdated",
    inputs: [
      {name: "creator", type: "address", indexed: true},
      {name: "handleHash", type: "bytes32", indexed: true},
      {name: "metadataURI", type: "string", indexed: false},
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TipReceipt",
    inputs: [
      {name: "creator", type: "address", indexed: true},
      {name: "token", type: "address", indexed: true},
      {name: "amount", type: "uint256", indexed: false},
      {name: "message", type: "string", indexed: false},
      {name: "routeId", type: "bytes32", indexed: true},
    ],
    anonymous: false,
  },
  // ── Yield strategy (Aave auto-supply) ──
  {
    type: "function",
    name: "POOL_PROVIDER",
    inputs: [],
    outputs: [{name: "", type: "address"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setYieldStrategy",
    inputs: [
      {name: "handle", type: "string"},
      {name: "strategy", type: "uint8"},
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "yieldStrategies",
    inputs: [{name: "", type: "bytes32"}],
    outputs: [{name: "", type: "uint8"}],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "YieldStrategySet",
    inputs: [
      {name: "handleHash", type: "bytes32", indexed: true},
      {name: "strategy", type: "uint8", indexed: false},
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "YieldDeposited",
    inputs: [
      {name: "creator", type: "address", indexed: true},
      {name: "token", type: "address", indexed: true},
      {name: "amount", type: "uint256", indexed: false},
    ],
    anonymous: false,
  },
  // ── Subscriptions ──
  {
    type: "function",
    name: "setSubConfig",
    inputs: [
      {name: "handle", type: "string"},
      {name: "enabled", type: "bool"},
      {name: "priceWei", type: "uint256"},
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "subscribe",
    inputs: [{name: "handle", type: "string"}],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "isSubscriber",
    inputs: [
      {name: "handleHash", type: "bytes32"},
      {name: "viewer", type: "address"},
    ],
    outputs: [{name: "", type: "bool"}],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "subConfigs",
    inputs: [{name: "", type: "bytes32"}],
    outputs: [
      {name: "enabled", type: "bool"},
      {name: "priceWei", type: "uint256"},
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "subExpiry",
    inputs: [
      {name: "", type: "bytes32"},
      {name: "", type: "address"},
    ],
    outputs: [{name: "", type: "uint256"}],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Subscribed",
    inputs: [
      {name: "subscriber", type: "address", indexed: true},
      {name: "creator", type: "address", indexed: true},
      {name: "handleHash", type: "bytes32", indexed: true},
      {name: "expiresAt", type: "uint256", indexed: false},
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SubConfigSet",
    inputs: [
      {name: "handleHash", type: "bytes32", indexed: true},
      {name: "enabled", type: "bool", indexed: false},
      {name: "priceWei", type: "uint256", indexed: false},
    ],
    anonymous: false,
  },
] as const;

type Address = `0x${string}`;

export const SAWER_REGISTRY_DEPLOYMENT = {
  celoSepolia: {
    address: "0xa4b56B42724364443b6e2979A2206Ee535801f4b" as Address,
    chainId: celoSepolia.id,
    deployTxHash: "0x29c6eea04c738619cbfc71e9ca1ee22679c858bd50b605d32a4d49631299d52f" as Address,
    deployBlock: 24257550n,
    explorer: "https://celo-sepolia.blockscout.com/address/0xa4b56B42724364443b6e2979A2206Ee535801f4b",
    blockExplorerTx: (tx: string) => `https://celo-sepolia.blockscout.com/tx/${tx}`,
  },
  celo: {
    address: "0x2112A54d0b3Df6c0f553E05459E75835A92570f1" as Address,
    chainId: celo.id,
    deployTxHash: "0xdb66ec3fe22040db664ec3a9573810d7c43a269395146970b189e08f88b5a11e" as Address,
    deployBlock: 65640826n,
    explorer: "https://explorer.celo.org/mainnet/address/0x2112A54d0b3Df6c0f553E05459E75835A92570f1",
    blockExplorerTx: (tx: string) => `https://explorer.celo.org/mainnet/tx/${tx}`,
  },
} as const;

export function getActiveRegistry() {
  const isMainnet = ACTIVE_CHAIN.id === celo.id;
  return isMainnet ? SAWER_REGISTRY_DEPLOYMENT.celo : SAWER_REGISTRY_DEPLOYMENT.celoSepolia;
}

export function handleHash(handle: string): Address {
  return keccak256(toBytes(handle));
}
