import {createConfig, getQuote} from "@lifi/sdk";
import type {LiFiStep} from "@lifi/sdk";
import {encodeFunctionData} from "viem";
import {ACTIVE_CHAIN} from "./publicClient";
import {ERC20_ABI, SOURCE_CHAIN_RPCS, isNativeToken} from "./tokens";

createConfig({integrator: "sawerlink-celo-proof-of-ship"});

export type CrossChainQuoteResult =
  | {kind: "ok"; step: LiFiStep; toAmount: string; tool: string}
  | {kind: "error"; message: string};

export type BridgeStatus = "PENDING" | "DONE" | "FAILED";

export interface SupportedSourceChain {
  id: number;
  name: string;
  nativeToken: string;
  nativeTokenAddress: string;
  explorerTx: (hash: string) => string;
}

export const SOURCE_CHAINS: SupportedSourceChain[] = [
  {
    id: 1,
    name: "Ethereum",
    nativeToken: "ETH",
    nativeTokenAddress: "0x0000000000000000000000000000000000000000",
    explorerTx: (h) => `https://etherscan.io/tx/${h}`,
  },
  {
    id: 137,
    name: "Polygon",
    nativeToken: "MATIC",
    nativeTokenAddress: "0x0000000000000000000000000000000000000000",
    explorerTx: (h) => `https://polygonscan.com/tx/${h}`,
  },
  {
    id: 8453,
    name: "Base",
    nativeToken: "ETH",
    nativeTokenAddress: "0x0000000000000000000000000000000000000000",
    explorerTx: (h) => `https://basescan.org/tx/${h}`,
  },
  {
    id: 42161,
    name: "Arbitrum",
    nativeToken: "ETH",
    nativeTokenAddress: "0x0000000000000000000000000000000000000000",
    explorerTx: (h) => `https://arbiscan.io/tx/${h}`,
  },
  {
    id: 10,
    name: "Optimism",
    nativeToken: "ETH",
    nativeTokenAddress: "0x0000000000000000000000000000000000000000",
    explorerTx: (h) => `https://optimistic.etherscan.io/tx/${h}`,
  },
];

const CELO_NATIVE = "0x471EcE3750Da237f93B8E339c536989b8978a438";

export async function fetchCrossChainQuote(
  fromChainId: number,
  fromTokenAddress: string,
  fromAmountWei: string,
  fromAddress: string,
  toAddress: string,
): Promise<CrossChainQuoteResult> {
  const sourceChain = SOURCE_CHAINS.find((c) => c.id === fromChainId);
  if (!sourceChain) return {kind: "error", message: "Unsupported source chain."};

  try {
    const quote = await getQuote({
      fromChain: fromChainId,
      fromToken: fromTokenAddress,
      fromAmount: fromAmountWei,
      fromAddress,
      toChain: ACTIVE_CHAIN.id,
      toToken: CELO_NATIVE,
      toAddress,
      order: "CHEAPEST",
      skipSimulation: true,
    });

    const toAmount = quote.estimate?.toAmount ?? "0";
    const tool = quote.toolDetails?.name ?? quote.tool ?? "bridge";

    return {kind: "ok", step: quote, toAmount, tool};
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Quote unavailable.",
    };
  }
}

export async function switchToChain(chainId: number): Promise<void> {
  const ethereum = window.ethereum;
  if (!ethereum) throw new Error("No wallet found.");
  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{chainId: `0x${chainId.toString(16)}`}],
    });
  } catch (err) {
    const code = (err as {code?: number}).code;
    if (code === 4902) {
      throw new Error(`Chain ${chainId} is not in your wallet. Add it in MetaMask first.`);
    }
    throw err;
  }
}

// For ERC-20 source tokens: check allowance, send approval if needed
export async function ensureAllowance(
  chainId: number,
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  requiredAmount: bigint,
): Promise<`0x${string}` | null> {
  const rpc = SOURCE_CHAIN_RPCS[chainId];
  if (!rpc) throw new Error("No RPC for chain " + chainId);

  const allowanceData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [ownerAddress as `0x${string}`, spenderAddress as `0x${string}`],
  });

  const resp = await fetch(rpc, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{to: tokenAddress, data: allowanceData}, "latest"],
    }),
  });
  const result = (await resp.json()) as {result?: string};
  const allowance = BigInt(result.result ?? "0x0");

  if (allowance >= requiredAmount) return null; // no approval needed

  // Send approval transaction
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spenderAddress as `0x${string}`, requiredAmount],
  });

  const ethereum = window.ethereum;
  if (!ethereum) throw new Error("No wallet found.");
  const approveTxHash = await ethereum.request({
    method: "eth_sendTransaction",
    params: [{from: ownerAddress, to: tokenAddress, data: approveData}],
  });

  return approveTxHash as `0x${string}`;
}

export async function waitForSourceTx(txHash: string, chainId: number): Promise<void> {
  const rpc = SOURCE_CHAIN_RPCS[chainId];
  if (!rpc) throw new Error("No RPC for chain " + chainId);

  for (let i = 0; i < 60; i++) {
    await new Promise<void>((r) => setTimeout(r, 5000));
    const resp = await fetch(rpc, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [txHash],
      }),
    });
    const data = (await resp.json()) as {result?: {status?: string}};
    if (data.result?.status === "0x1") return;
    if (data.result?.status === "0x0") throw new Error("Approval transaction failed on-chain.");
  }
  throw new Error("Approval confirmation timed out.");
}

export async function sendStepTx(
  step: LiFiStep,
  fromAddress: string,
  fromChainId: number,
  fromTokenAddress: string,
): Promise<`0x${string}`> {
  const ethereum = window.ethereum;
  if (!ethereum) throw new Error("No wallet found.");

  const tx = step.transactionRequest as Record<string, unknown> | undefined;
  if (!tx?.to) throw new Error("No transaction request in quote. Try getting a fresh quote.");

  // ERC-20 source tokens need approval before bridging
  if (!isNativeToken(fromTokenAddress)) {
    const approvalAddress = (step.estimate as unknown as Record<string, unknown>)?.approvalAddress as string | undefined;
    if (approvalAddress) {
      const fromAmount = BigInt((step.action as unknown as Record<string, unknown>).fromAmount as string);
      const approveTxHash = await ensureAllowance(
        fromChainId,
        fromTokenAddress,
        fromAddress,
        approvalAddress,
        fromAmount,
      );
      if (approveTxHash) {
        await waitForSourceTx(approveTxHash, fromChainId);
      }
    }
  }

  const value = tx.value != null
    ? typeof tx.value === "string" && (tx.value as string).startsWith("0x")
      ? tx.value
      : `0x${BigInt(String(tx.value)).toString(16)}`
    : "0x0";

  const params: Record<string, unknown> = {
    from: fromAddress,
    to: tx.to,
    data: tx.data ?? "0x",
    value,
  };
  if (tx.gasLimit) {
    params.gas = typeof tx.gasLimit === "string" && (tx.gasLimit as string).startsWith("0x")
      ? tx.gasLimit
      : `0x${BigInt(String(tx.gasLimit)).toString(16)}`;
  }

  const txHash = await ethereum.request({method: "eth_sendTransaction", params: [params]});
  return txHash as `0x${string}`;
}

export async function pollBridgeStatus(
  txHash: string,
  step: LiFiStep,
  onUpdate: (s: BridgeStatus) => void,
): Promise<BridgeStatus> {
  const bridge = step.tool;
  const fromChain = (step.action as {fromChainId: number}).fromChainId;
  const toChain = (step.action as {toChainId: number}).toChainId;

  for (let i = 0; i < 120; i++) {
    await new Promise<void>((r) => setTimeout(r, 5000));
    try {
      const url = `https://li.quest/v1/status?txHash=${txHash}&bridge=${bridge}&fromChain=${fromChain}&toChain=${toChain}`;
      const resp = await fetch(url);
      const data = (await resp.json()) as {status?: string};
      const s = data.status ?? "PENDING";
      if (s === "DONE") {onUpdate("DONE"); return "DONE";}
      if (s === "FAILED" || s === "INVALID") {onUpdate("FAILED"); return "FAILED";}
      onUpdate("PENDING");
    } catch {
      // not indexed yet — keep polling
    }
  }
  return "FAILED";
}
