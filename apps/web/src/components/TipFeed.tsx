import {useCallback, useEffect, useState} from "react";
import {formatEther} from "viem";
import type {Address} from "viem";
import {publicClient} from "../lib/publicClient";
import {SAWER_REGISTRY_ABI, getActiveRegistry} from "../lib/contract";

interface TipEntry {
  txHash: `0x${string}`;
  blockNumber: bigint;
  amount: bigint;
  message: string;
  token: Address;
}

interface Props {
  creatorAddress: Address;
}

export function TipFeed({creatorAddress}: Props) {
  const [tips, setTips] = useState<TipEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTips = useCallback(async () => {
    const registry = getActiveRegistry();
    setLoading(true);
    setError(null);
    try {
      const logs = await publicClient.getLogs({
        address: registry.address,
        event: SAWER_REGISTRY_ABI.find((x) => x.type === "event" && x.name === "TipReceipt") as (typeof SAWER_REGISTRY_ABI)[number] & {type: "event"},
        args: {creator: creatorAddress},
        fromBlock: registry.deployBlock,
        toBlock: "latest",
      });

      const entries: TipEntry[] = logs
        .slice(-20)
        .reverse()
        .map((log) => ({
          txHash: log.transactionHash ?? ("0x" as `0x${string}`),
          blockNumber: log.blockNumber ?? 0n,
          amount: (log.args as {amount?: bigint}).amount ?? 0n,
          message: (log.args as {message?: string}).message ?? "",
          token: (log.args as {token?: Address}).token ?? ("0x" as Address),
        }));

      setTips(entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tip history.");
    } finally {
      setLoading(false);
    }
  }, [creatorAddress]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTips();
  }, [loadTips]);

  if (loading) {
    return <p className="hint center">Loading tip history…</p>;
  }

  if (error) {
    return <p className="hint center">Could not load tip history.</p>;
  }

  if (tips.length === 0) {
    return (
      <div className="tip-feed empty">
        <p className="hint center">No tips yet — be the first!</p>
      </div>
    );
  }

  const totalReceived = tips.reduce((sum, t) => sum + t.amount, 0n);

  return (
    <div className="tip-feed">
      <div className="tip-feed-header">
        <p className="label">Recent tips</p>
        <p className="tip-total">{formatTipAmount(totalReceived)} CELO total</p>
      </div>
      <ul className="tip-list">
        {tips.map((tip) => (
          <li key={tip.txHash} className="tip-item">
            <div className="tip-amount">
              {formatTipAmount(tip.amount)} CELO
            </div>
            {tip.message && <p className="tip-message">"{tip.message}"</p>}
            <a
              className="tip-tx"
              href={getActiveRegistry().blockExplorerTx(tip.txHash)}
              target="_blank"
              rel="noreferrer"
            >
              {tip.txHash.slice(0, 10)}…
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatTipAmount(amount: bigint): string {
  try {
    const eth = parseFloat(formatEther(amount));
    return eth.toFixed(eth < 0.001 ? 6 : 4);
  } catch {
    return "?";
  }
}
