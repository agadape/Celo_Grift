import {createWalletClient, custom, type Address} from "viem";
import {ACTIVE_CHAIN} from "./publicClient";

type EthereumProvider = {
  isMiniPay?: boolean;
  isMetaMask?: boolean;
  request: (args: {method: string; params?: unknown}) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const TARGET_CHAIN_HEX = `0x${ACTIVE_CHAIN.id.toString(16)}`;

export type ConnectedWallet = {
  address: Address;
  isMiniPay: boolean;
};

export async function connectWallet(): Promise<ConnectedWallet> {
  const ethereum = window.ethereum;
  if (!ethereum) {
    throw new Error(
      "No wallet found. Install MetaMask in this browser, or open this page in MiniPay on your phone."
    );
  }

  const accounts = (await ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!accounts || !accounts[0]) {
    throw new Error("Wallet did not return an account.");
  }

  const isMiniPay = Boolean(ethereum.isMiniPay);

  if (!isMiniPay) {
    await ensureCorrectChain(ethereum);
  }

  return {
    address: accounts[0] as Address,
    isMiniPay,
  };
}

async function ensureCorrectChain(ethereum: EthereumProvider): Promise<void> {
  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{chainId: TARGET_CHAIN_HEX}],
    });
  } catch (err) {
    const code = (err as {code?: number}).code;
    if (code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: TARGET_CHAIN_HEX,
            chainName: ACTIVE_CHAIN.name,
            rpcUrls: ACTIVE_CHAIN.rpcUrls.default.http,
            nativeCurrency: ACTIVE_CHAIN.nativeCurrency,
            blockExplorerUrls: [ACTIVE_CHAIN.blockExplorers?.default.url],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

export function getWalletClient() {
  const ethereum = window.ethereum;
  if (!ethereum) {
    throw new Error("No wallet provider available.");
  }
  return createWalletClient({
    chain: ACTIVE_CHAIN,
    transport: custom(ethereum),
  });
}
