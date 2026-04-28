import {createPublicClient, http} from "viem";
import {celo, celoSepolia} from "viem/chains";

// VITE_CHAIN=mainnet → Celo mainnet; anything else → Celo Sepolia (dev default)
const isMainnet = import.meta.env.VITE_CHAIN === "mainnet";

export const ACTIVE_CHAIN = isMainnet ? celo : celoSepolia;

export const publicClient = createPublicClient({
  chain: ACTIVE_CHAIN,
  transport: http(),
});
