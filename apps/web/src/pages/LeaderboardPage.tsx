import {useEffect, useState} from "react";
import {Link} from "react-router-dom";
import {formatUnits} from "viem";
import type {Address} from "viem";
import {publicClient} from "../lib/publicClient";
import {SAWER_REGISTRY_ABI, getActiveRegistry} from "../lib/contract";

const REGISTRY = getActiveRegistry();
const ZERO = "0x0000000000000000000000000000000000000000";

interface CreatorRow {
  address: string;
  handle: string;
  totalCelo: bigint;
  tipCount: number;
}

interface TipRow {
  txHash: string;
  creator: string;
  handle: string;
  amount: bigint;
  token: string;
  tokenSymbol: string;
  tokenDecimals: number;
  message: string;
}

const TOKEN_META: Record<string, {symbol: string; decimals: number}> = {
  [ZERO]: {symbol: "CELO", decimals: 18},
  "0x765de816845861e75a25fca122bb6898b8b1282a": {symbol: "cUSD", decimals: 18},
  "0xceba9300f2b948710d2653dd7b07f33a8b32118c": {symbol: "USDC", decimals: 6},
  "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e": {symbol: "USDT", decimals: 6},
  "0x874069fa1eb16d44d622f2e0ca25eea172369bc1": {symbol: "cUSD", decimals: 18},
};

function tokenMeta(addr: string) {
  return TOKEN_META[addr.toLowerCase()] ?? {symbol: "tokens", decimals: 18};
}

function fmt(amount: bigint, addr: string) {
  const {symbol, decimals} = tokenMeta(addr);
  const val = parseFloat(formatUnits(amount, decimals));
  const str = val < 0.01 ? val.toFixed(4) : val.toFixed(2);
  return `${str} ${symbol}`;
}

export function LeaderboardPage() {
  const [creators, setCreators] = useState<CreatorRow[]>([]);
  const [tips, setTips] = useState<TipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Leaderboard · SawerLink";
    return () => { document.title = "SawerLink"; };
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [tipLogs, creatorLogs] = await Promise.all([
          publicClient.getLogs({
            address: REGISTRY.address,
            event: SAWER_REGISTRY_ABI.find((x) => x.type === "event" && x.name === "TipReceipt") as (typeof SAWER_REGISTRY_ABI)[number] & {type: "event"},
            fromBlock: REGISTRY.deployBlock,
            toBlock: "latest",
          }),
          publicClient.getLogs({
            address: REGISTRY.address,
            event: SAWER_REGISTRY_ABI.find((x) => x.type === "event" && x.name === "CreatorRegistered") as (typeof SAWER_REGISTRY_ABI)[number] & {type: "event"},
            fromBlock: REGISTRY.deployBlock,
            toBlock: "latest",
          }),
        ]);

        // address → handle (last registration wins)
        const handleMap = new Map<string, string>();
        for (const log of creatorLogs) {
          const addr = ((log.args as {creator?: string}).creator ?? "").toLowerCase();
          const handle = (log.args as {handle?: string}).handle ?? "";
          handleMap.set(addr, handle);
        }

        // Aggregate CELO per creator
        const celoByCreator = new Map<string, {total: bigint; count: number}>();
        for (const log of tipLogs) {
          const creator = ((log.args as {creator?: string}).creator ?? "").toLowerCase();
          const token = ((log.args as {token?: string}).token ?? "").toLowerCase();
          const amount = (log.args as {amount?: bigint}).amount ?? 0n;
          if (token === ZERO) {
            const existing = celoByCreator.get(creator) ?? {total: 0n, count: 0};
            celoByCreator.set(creator, {total: existing.total + amount, count: existing.count + 1});
          }
        }

        const creatorRows: CreatorRow[] = [...celoByCreator.entries()]
          .map(([address, {total, count}]) => ({
            address,
            handle: handleMap.get(address) ?? address.slice(0, 8),
            totalCelo: total,
            tipCount: count,
          }))
          .sort((a, b) => (b.totalCelo > a.totalCelo ? 1 : -1))
          .slice(0, 10);

        // Top individual tips across all tokens
        const tipRows: TipRow[] = tipLogs
          .map((log) => {
            const creator = ((log.args as {creator?: string}).creator ?? "").toLowerCase();
            const token = ((log.args as {token?: string}).token ?? "").toLowerCase();
            const amount = (log.args as {amount?: bigint}).amount ?? 0n;
            const message = (log.args as {message?: string}).message ?? "";
            const {symbol, decimals} = tokenMeta(token);
            return {
              txHash: log.transactionHash ?? "",
              creator,
              handle: handleMap.get(creator) ?? creator.slice(0, 8),
              amount,
              token,
              tokenSymbol: symbol,
              tokenDecimals: decimals,
              message,
            };
          })
          // Sort CELO tips by raw amount; mixed-token sort is approximate
          .sort((a, b) => {
            const av = parseFloat(formatUnits(a.amount, a.tokenDecimals));
            const bv = parseFloat(formatUnits(b.amount, b.tokenDecimals));
            return bv - av;
          })
          .slice(0, 10);

        setCreators(creatorRows);
        setTips(tipRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <main className="shell narrow" style={{maxWidth: 860}}>
      <Link to="/" className="back-link">← Back</Link>
      <h1 className="page-title">Leaderboard</h1>
      <p className="lede">Top creators and biggest tips on SawerLink.</p>

      {loading && (
        <div className="lb-grid">
          {[0, 1].map((p) => (
            <div key={p} className="lb-panel">
              <span className="skeleton skeleton-line" style={{width: "55%"}} />
              {Array.from({length: 6}).map((_, i) => (
                <div key={i} style={{display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f0f5f0"}}>
                  <span className="skeleton" style={{width: 24, height: 14, flexShrink: 0}} />
                  <span className="skeleton skeleton-line" style={{flex: 1}} />
                  <span className="skeleton" style={{width: 72, height: 14, flexShrink: 0}} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <div className="lb-grid">
          {/* Top creators */}
          <section className="lb-panel">
            <p className="label">🏆 Top creators by CELO received</p>
            {creators.length === 0 ? (
              <p className="hint">No CELO tips yet.</p>
            ) : (
              <ol className="lb-list">
                {creators.map((c, i) => (
                  <li key={c.address} className="lb-item">
                    <span className={`lb-rank${i === 0 ? " lb-rank--gold" : i === 1 ? " lb-rank--silver" : i === 2 ? " lb-rank--bronze" : ""}`}>
                      {i + 1}
                    </span>
                    <div className="lb-item-body">
                      <Link to={`/s/${c.handle}`} className="lb-handle">@{c.handle}</Link>
                      <span className="lb-meta">{c.tipCount} tip{c.tipCount !== 1 ? "s" : ""}</span>
                    </div>
                    <span className="lb-amount">{fmt(c.totalCelo, ZERO)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Biggest individual tips */}
          <section className="lb-panel">
            <p className="label">⚡ Biggest single tips</p>
            {tips.length === 0 ? (
              <p className="hint">No tips yet.</p>
            ) : (
              <ol className="lb-list">
                {tips.map((t, i) => (
                  <li key={`${t.txHash}-${i}`} className="lb-item">
                    <span className={`lb-rank${i === 0 ? " lb-rank--gold" : i === 1 ? " lb-rank--silver" : i === 2 ? " lb-rank--bronze" : ""}`}>
                      {i + 1}
                    </span>
                    <div className="lb-item-body">
                      <Link to={`/s/${t.handle}`} className="lb-handle">@{t.handle}</Link>
                      {t.message && <span className="lb-meta">"{t.message.slice(0, 40)}"</span>}
                    </div>
                    <span className="lb-amount">{fmt(t.amount, t.token)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      {!loading && !error && creators.length === 0 && tips.length === 0 && (
        <p className="hint center">
          No tips recorded yet.{" "}
          <Link to="/create">Be the first creator!</Link>
        </p>
      )}
    </main>
  );
}
