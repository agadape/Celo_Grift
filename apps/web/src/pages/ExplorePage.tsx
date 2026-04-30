import {useEffect, useState} from "react";
import {Link} from "react-router-dom";
import {publicClient, ACTIVE_CHAIN} from "../lib/publicClient";
import {SAWER_REGISTRY_ABI, getActiveRegistry} from "../lib/contract";
import {decodeMetadata} from "../lib/metadata";

const REGISTRY = getActiveRegistry();

interface CreatorCard {
  address: string;
  handle: string;
  name: string;
  bio: string;
  avatar: string;
}

export function ExplorePage() {
  const [creators, setCreators] = useState<CreatorCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const logs = await publicClient.getLogs({
          address: REGISTRY.address,
          event: SAWER_REGISTRY_ABI.find(
            (x) => x.type === "event" && x.name === "CreatorRegistered",
          ) as (typeof SAWER_REGISTRY_ABI)[number] & {type: "event"},
          fromBlock: REGISTRY.deployBlock,
          toBlock: "latest",
        });

        // Deduplicate by address — keep last registration per creator
        const seen = new Map<string, CreatorCard>();
        for (const log of logs) {
          const addr = ((log.args as {creator?: string}).creator ?? "").toLowerCase();
          const handle = (log.args as {handle?: string}).handle ?? "";
          const metadataURI = (log.args as {metadataURI?: string}).metadataURI ?? "";
          const profile = decodeMetadata(metadataURI);
          seen.set(addr, {
            address: addr,
            handle,
            name: profile?.name || `@${handle}`,
            bio: profile?.bio ?? "",
            avatar: profile?.avatar ?? "",
          });
        }

        setCreators([...seen.values()].reverse().slice(0, 48));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load creators.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <main className="shell narrow" style={{maxWidth: 860}}>
      <Link to="/" className="back-link">← Back</Link>
      <h1 className="page-title">Explore creators</h1>
      <p className="lede">Everyone on SawerLink on {ACTIVE_CHAIN.name}.</p>

      {loading && (
        <div className="skeleton-grid">
          {Array.from({length: 12}).map((_, i) => (
            <div key={i} className="skeleton-creator-card">
              <span className="skeleton skeleton-avatar" style={{width: 52, height: 52, flexShrink: 0}} />
              <div className="skeleton-creator-card-body">
                <span className="skeleton skeleton-line skeleton-line--lg" style={{width: "70%"}} />
                <span className="skeleton skeleton-line skeleton-line--sm" style={{width: "45%"}} />
                <span className="skeleton skeleton-line skeleton-line--sm" style={{width: "90%"}} />
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {!loading && !error && creators.length === 0 && (
        <p className="hint center">
          No creators registered yet.{" "}
          <Link to="/create">Be the first!</Link>
        </p>
      )}

      {creators.length > 0 && (
        <div className="explore-grid">
          {creators.map((c) => (
            <Link key={c.address} to={`/s/${c.handle}`} className="creator-card">
              {c.avatar ? (
                <img
                  className="creator-card-avatar"
                  src={c.avatar}
                  alt={c.name}
                  width={52}
                  height={52}
                />
              ) : (
                <div className="creator-card-avatar creator-card-avatar--placeholder">
                  {c.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="creator-card-body">
                <p className="creator-card-name">{c.name}</p>
                <p className="creator-card-handle">@{c.handle}</p>
                {c.bio && <p className="creator-card-bio">{c.bio}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
