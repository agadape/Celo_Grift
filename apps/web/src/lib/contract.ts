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
] as const;

type Address = `0x${string}`;

export const SAWER_REGISTRY_DEPLOYMENT = {
  celoSepolia: {
    address: "0x8A8C3E9Ed4e1C00645a31d44bA4Ec8A76F6d4017" as Address,
    chainId: celoSepolia.id,
    deployTxHash: "0x899dc7bcb37e9a5aa53b7c2cafb0b961ced55a92b11440da336bfed00c65e725" as Address,
    deployBlock: 23910870n,
    explorer: "https://celo-sepolia.blockscout.com/address/0x8a8c3e9ed4e1c00645a31d44ba4ec8a76f6d4017",
    blockExplorerTx: (tx: string) => `https://celo-sepolia.blockscout.com/tx/${tx}`,
  },
  celo: {
    address: "0x7132Ae4BF031bAe1260f32c467D1914E7DCda647" as Address,
    chainId: celo.id,
    deployTxHash: "0x578d7a57f4114f7964ba9f397bec390f2be71170fc4689961675efdd39bc43a2" as Address,
    deployBlock: 65383542n,
    explorer: "https://explorer.celo.org/mainnet/address/0x7132Ae4BF031bAe1260f32c467D1914E7DCda647",
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
