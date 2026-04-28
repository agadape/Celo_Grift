import {useEffect, useState} from "react";
import {Link} from "react-router-dom";
import {publicClient, ACTIVE_CHAIN} from "../lib/publicClient";
import {SAWER_REGISTRY_ABI, getActiveRegistry} from "../lib/contract";

function usePlatformStats() {
  const [stats, setStats] = useState<{creators: number; tips: number} | null>(null);
  useEffect(() => {
    const registry = getActiveRegistry();
    async function load() {
      try {
        const [creatorLogs, tipLogs] = await Promise.all([
          publicClient.getLogs({
            address: registry.address,
            event: SAWER_REGISTRY_ABI.find((x) => x.type === "event" && x.name === "CreatorRegistered") as (typeof SAWER_REGISTRY_ABI)[number] & {type: "event"},
            fromBlock: registry.deployBlock,
            toBlock: "latest",
          }),
          publicClient.getLogs({
            address: registry.address,
            event: SAWER_REGISTRY_ABI.find((x) => x.type === "event" && x.name === "TipReceipt") as (typeof SAWER_REGISTRY_ABI)[number] & {type: "event"},
            fromBlock: registry.deployBlock,
            toBlock: "latest",
          }),
        ]);
        const uniqueCreators = new Set(creatorLogs.map((l) => (l.args as {creator?: string}).creator?.toLowerCase())).size;
        setStats({creators: uniqueCreators, tips: tipLogs.length});
      } catch { /* non-critical */ }
    }
    void load();
  }, []);
  return stats;
}

export function HomePage() {
  const stats = usePlatformStats();

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Celo · {ACTIVE_CHAIN.name}</p>
          <h1>SawerLink</h1>
          <p className="lede">
            One creator tipping link. Supporters pay from any LI.FI-supported
            chain. Creators receive stablecoins on Celo MiniPay.
          </p>
          {stats && (
            <div className="home-stats">
              <span><strong>{stats.creators}</strong> creator{stats.creators !== 1 ? "s" : ""}</span>
              <span className="home-stats-dot">·</span>
              <span><strong>{stats.tips}</strong> tip{stats.tips !== 1 ? "s" : ""} sent</span>
            </div>
          )}
          <div className="cta-row">
            <Link to="/create" className="btn-primary">
              Create your link
            </Link>
            <Link to="/s/sawerlink" className="btn-secondary">
              Try a demo tip
            </Link>
            <Link to="/explore" className="btn-secondary">
              Explore creators
            </Link>
          </div>
        </div>

        <div className="creator-panel" aria-label="How it works">
          <span className="label">How it works</span>
          <ol className="numbered">
            <li>
              <strong>Create.</strong> Connect MiniPay and reserve your handle on Celo.
            </li>
            <li>
              <strong>Share.</strong> Get a link like{" "}
              <code>sawerlink.app/s/yourname</code>.
            </li>
            <li>
              <strong>Receive.</strong> Supporters tip in stablecoins. Receipts land on-chain.
            </li>
          </ol>
        </div>
      </section>

      <section className="workflow" aria-label="Why SawerLink">
        <article>
          <span>1</span>
          <h2>No platform cut</h2>
          <p>Saweria charges 5–6%. SawerLink charges sub-cent gas only.</p>
        </article>
        <article>
          <span>2</span>
          <h2>Cross-chain</h2>
          <p>Supporters pay from any LI.FI-supported chain. Routed to Celo automatically.</p>
        </article>
        <article>
          <span>3</span>
          <h2>Non-custodial</h2>
          <p>Funds go straight to your MiniPay wallet. No withdrawal queue, no banking hours.</p>
        </article>
      </section>
    </main>
  );
}
