import {useState} from "react";
import {parseUnits, formatUnits, formatEther} from "viem";
import type {Address} from "viem";
import {
  SOURCE_CHAINS,
  fetchCrossChainQuote,
  switchToChain,
  sendStepTx,
  pollBridgeStatus,
  type CrossChainQuoteResult,
} from "../lib/lifi";
import {SOURCE_CHAIN_TOKENS, isNativeToken} from "../lib/tokens";
import {getWalletClient} from "../lib/wallet";
import {publicClient, ACTIVE_CHAIN} from "../lib/publicClient";
import {SAWER_REGISTRY_ABI, getActiveRegistry} from "../lib/contract";
import {buildMessage, isValidMediaUrl, mediaHint} from "../lib/media";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const REACTIONS = ["🔥", "❤️", "💎", "🚀", "👑", "⚡", "🎉", "💯"];

interface Props {
  supporterAddress: string | null;
  creatorAddress: string;
  creatorHandle: string;
}

type ExecState =
  | {kind: "idle"}
  | {kind: "switching"}
  | {kind: "approving"}
  | {kind: "sending"}
  | {kind: "bridging"; txHash: string}
  | {kind: "recording"}
  | {kind: "done"; sourceTxHash: string; receiptTxHash: string}
  | {kind: "exec-error"; message: string};

export function CrossChainQuote({supporterAddress, creatorAddress, creatorHandle}: Props) {
  const [fromChainId, setFromChainId] = useState(1);
  const [fromTokenIdx, setFromTokenIdx] = useState(0);
  const [fromAmount, setFromAmount] = useState("10");
  const [message, setMessage] = useState("");
  const [reaction, setReaction] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [quoteState, setQuoteState] = useState<
    {kind: "idle"} | {kind: "loading"} | CrossChainQuoteResult
  >({kind: "idle"});
  const [execState, setExecState] = useState<ExecState>({kind: "idle"});

  const selectedChain = SOURCE_CHAINS.find((c) => c.id === fromChainId)!;
  const chainTokens = SOURCE_CHAIN_TOKENS[fromChainId] ?? [];
  const selectedToken = chainTokens[fromTokenIdx] ?? chainTokens[0];
  const isExecuting = ["switching", "approving", "sending", "bridging", "recording"].includes(
    execState.kind,
  );

  function handleChainChange(chainId: number) {
    setFromChainId(chainId);
    setFromTokenIdx(0);
    setQuoteState({kind: "idle"});
    setExecState({kind: "idle"});
  }

  async function handleGetQuote() {
    if (!supporterAddress) {
      setQuoteState({kind: "error", message: "Connect your wallet first."});
      return;
    }
    if (!selectedToken) {
      setQuoteState({kind: "error", message: "Select a token."});
      return;
    }
    let amountWei: bigint;
    try {
      amountWei = parseUnits(fromAmount || "0", selectedToken.decimals);
      if (amountWei <= 0n) throw new Error();
    } catch {
      setQuoteState({kind: "error", message: "Enter a valid amount."});
      return;
    }
    setQuoteState({kind: "loading"});
    setExecState({kind: "idle"});
    const result = await fetchCrossChainQuote(
      fromChainId,
      selectedToken.address,
      amountWei.toString(),
      supporterAddress,
      creatorAddress,
    );
    setQuoteState(result);
  }

  async function handleExecute() {
    if (quoteState.kind !== "ok" || !supporterAddress || !selectedToken) return;
    const {step} = quoteState;

    try {
      // 1. Switch to source chain
      setExecState({kind: "switching"});
      await switchToChain(fromChainId);

      // 2. Approve if ERC-20 (handled inside sendStepTx, shows approving state)
      if (!isNativeToken(selectedToken.address)) {
        setExecState({kind: "approving"});
      } else {
        setExecState({kind: "sending"});
      }

      // 3. Send bridge tx (approval is handled inside if needed)
      const sourceTxHash = await sendStepTx(
        step,
        supporterAddress,
        fromChainId,
        selectedToken.address,
      );
      // After approval done (if any), now sending main tx
      setExecState({kind: "sending"});
      // If approval was needed, sourceTxHash is the bridge tx (approval was awaited inside sendStepTx)

      // 4. Wait for bridge
      setExecState({kind: "bridging", txHash: sourceTxHash});
      const finalStatus = await pollBridgeStatus(sourceTxHash, step, (s) => {
        if (s === "PENDING") setExecState({kind: "bridging", txHash: sourceTxHash});
      });

      if (finalStatus === "FAILED") {
        setExecState({
          kind: "exec-error",
          message:
            "Bridge failed. Your source transaction may have succeeded — check the explorer.",
        });
        return;
      }

      // 5. Switch back to Celo and record tip
      setExecState({kind: "recording"});
      await switchToChain(ACTIVE_CHAIN.id);

      const registry = getActiveRegistry();
      const walletClient = getWalletClient();
      const toAmount = BigInt(step.estimate?.toAmount ?? "0");

      const fullMessage = buildMessage(message, reaction, mediaUrl);
      const receiptTxHash = await walletClient.writeContract({
        account: supporterAddress as Address,
        address: registry.address,
        abi: SAWER_REGISTRY_ABI,
        functionName: "recordTip",
        args: [
          creatorHandle,
          ZERO_ADDRESS,
          toAmount,
          fullMessage.slice(0, 400),
          sourceTxHash,
        ],
      });
      await publicClient.waitForTransactionReceipt({hash: receiptTxHash});

      setExecState({kind: "done", sourceTxHash, receiptTxHash});
      setMessage("");
      setReaction("");
      setMediaUrl("");
    } catch (err) {
      setExecState({
        kind: "exec-error",
        message: err instanceof Error ? err.message : "Execution failed.",
      });
    }
  }

  return (
    <div className="xchain-widget">
      <p className="label">Cross-chain tip (optional)</p>
      <p className="hint">Pay from another chain — LI.FI routes it to CELO automatically.</p>

      {/* Chain + token + amount row */}
      <div className="xchain-controls">
        <select
          value={fromChainId}
          onChange={(e) => handleChainChange(Number(e.target.value))}
          disabled={isExecuting}
        >
          {SOURCE_CHAINS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={fromTokenIdx}
          onChange={(e) => {
            setFromTokenIdx(Number(e.target.value));
            setQuoteState({kind: "idle"});
            setExecState({kind: "idle"});
          }}
          disabled={isExecuting}
        >
          {chainTokens.map((t, i) => (
            <option key={t.symbol} value={i}>
              {t.symbol}
            </option>
          ))}
        </select>

        <input
          type="number"
          min="0"
          step="any"
          value={fromAmount}
          onChange={(e) => {
            setFromAmount(e.target.value);
            setQuoteState({kind: "idle"});
            setExecState({kind: "idle"});
          }}
          disabled={isExecuting}
          className="xchain-amount-input"
        />

        <button
          type="button"
          className="btn-secondary"
          onClick={handleGetQuote}
          disabled={quoteState.kind === "loading" || isExecuting}
        >
          {quoteState.kind === "loading" ? "…" : "Quote"}
        </button>
      </div>

      {/* Quote result */}
      {quoteState.kind === "ok" && execState.kind === "idle" && (
        <div className="xchain-result ok">
          <div className="xchain-summary">
            <span>
              Send{" "}
              <strong>
                {formatUnits(
                  BigInt(
                    (quoteState.step.estimate as {fromAmount?: string})?.fromAmount ?? "0",
                  ),
                  selectedToken?.decimals ?? 18,
                )}{" "}
                {selectedToken?.symbol}
              </strong>{" "}
              on {selectedChain.name}
            </span>
            <span className="xchain-arrow">→</span>
            <span>
              Creator gets{" "}
              <strong>{formatEther(BigInt(quoteState.toAmount))} CELO</strong>
            </span>
          </div>
          <p className="hint">via {quoteState.tool}</p>

          <div>
            <span className="label">Reaction <span className="opt">(optional)</span></span>
            <div className="emoji-row">
              {REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={reaction === e ? "emoji-btn active" : "emoji-btn"}
                  onClick={() => setReaction(reaction === e ? "" : e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <label>
            <span className="label">Message (optional)</span>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, mediaUrl ? 120 : 200))}
              placeholder="Thanks for the stream!"
              maxLength={mediaUrl ? 120 : 200}
            />
          </label>

          <div>
            <span className="label">Media <span className="opt">(optional — shows in OBS overlay)</span></span>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value.slice(0, 180))}
              placeholder="YouTube link, GIF, or image URL"
              className={mediaUrl && !isValidMediaUrl(mediaUrl) ? "input-error" : ""}
            />
            {mediaUrl && (
              <p className={`hint ${isValidMediaUrl(mediaUrl) ? "avail-hint-ok" : "avail-hint-no"}`}>
                {isValidMediaUrl(mediaUrl) ? mediaHint(mediaUrl) : "Unsupported URL"}
              </p>
            )}
          </div>

          <button type="button" className="btn-primary xchain-exec-btn" onClick={handleExecute}>
            Execute route
          </button>
        </div>
      )}

      {/* Execution status */}
      {execState.kind === "switching" && (
        <p className="hint">Switching to {selectedChain.name} in MetaMask…</p>
      )}
      {execState.kind === "approving" && (
        <p className="hint">
          Step 1/2 — Approve {selectedToken?.symbol} spend. Confirm in MetaMask…
        </p>
      )}
      {execState.kind === "sending" && (
        <p className="hint">
          {isNativeToken(selectedToken?.address ?? "") ? "" : "Step 2/2 — "}
          Confirm the bridge transaction in MetaMask…
        </p>
      )}
      {execState.kind === "bridging" && (
        <div className="xchain-result ok">
          <p className="hint">Bridge in progress — this can take a few minutes.</p>
          <a
            href={selectedChain.explorerTx(execState.txHash)}
            target="_blank"
            rel="noreferrer"
            className="hint"
          >
            View source tx →
          </a>
        </div>
      )}
      {execState.kind === "recording" && (
        <p className="hint">Bridge complete! Switching back to Celo to log receipt…</p>
      )}
      {execState.kind === "done" && (
        <div className="xchain-result ok">
          <p>
            <strong>Bridge complete!</strong> Funds arrived on Celo.
          </p>
          <a
            href={selectedChain.explorerTx(execState.sourceTxHash)}
            target="_blank"
            rel="noreferrer"
          >
            View source tx
          </a>
          {" · "}
          <a
            href={getActiveRegistry().blockExplorerTx(execState.receiptTxHash)}
            target="_blank"
            rel="noreferrer"
          >
            View receipt
          </a>
        </div>
      )}
      {execState.kind === "exec-error" && (
        <p className="error">{execState.message}</p>
      )}
      {quoteState.kind === "error" && execState.kind === "idle" && (
        <p className="error">{quoteState.message}</p>
      )}
    </div>
  );
}
