import {useEffect, useState} from "react";
import {Link} from "react-router-dom";
import {type Address} from "viem";
import {connectWallet} from "../lib/wallet";
import {publicClient, ACTIVE_CHAIN} from "../lib/publicClient";
import {SAWER_REGISTRY_ABI, getActiveRegistry, handleHash} from "../lib/contract";
import {TipFeed} from "../components/TipFeed";
import {decodeMetadata} from "../lib/metadata";

const REGISTRY = getActiveRegistry();

type DashState =
  | {kind: "idle"}
  | {kind: "loading"}
  | {kind: "found"; handle: string; payoutAddress: Address; metadataURI: string}
  | {kind: "not-registered"}
  | {kind: "error"; message: string};

export function DashboardPage() {
  const [address, setAddress] = useState<Address | null>(null);
  const [dashState, setDashState] = useState<DashState>({kind: "idle"});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum?.isMiniPay) {
      void handleConnect();
    }
  }, []);

  async function handleConnect() {
    try {
      const wallet = await connectWallet();
      setAddress(wallet.address);
      await loadDashboard(wallet.address);
    } catch (err) {
      setDashState({
        kind: "error",
        message: err instanceof Error ? err.message : "Could not connect.",
      });
    }
  }

  async function loadDashboard(addr: Address) {
    setDashState({kind: "loading"});
    try {
      const logs = await publicClient.getLogs({
        address: REGISTRY.address,
        event: SAWER_REGISTRY_ABI.find(
          (x) => x.type === "event" && x.name === "CreatorRegistered",
        ) as (typeof SAWER_REGISTRY_ABI)[number] & {type: "event"},
        args: {creator: addr},
        fromBlock: REGISTRY.deployBlock,
        toBlock: "latest",
      });

      if (logs.length === 0) {
        setDashState({kind: "not-registered"});
        return;
      }

      // Use the most recent registration
      const log = logs[logs.length - 1];
      const registeredHandle = (log.args as {handle?: string}).handle ?? "";

      // Fetch current record in case metadata was updated since registration
      const result = await publicClient.readContract({
        address: REGISTRY.address,
        abi: SAWER_REGISTRY_ABI,
        functionName: "creatorsByHandle",
        args: [handleHash(registeredHandle)],
      });

      if (!result[3]) {
        setDashState({kind: "not-registered"});
        return;
      }

      setDashState({
        kind: "found",
        handle: registeredHandle,
        payoutAddress: result[0],
        metadataURI: result[2],
      });
    } catch (err) {
      setDashState({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to load dashboard.",
      });
    }
  }

  function copyTipLink(handle: string) {
    const url = `${window.location.origin}/s/${handle}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <main className="shell narrow">
      <Link to="/" className="back-link">
        ← Back
      </Link>
      <h1 className="page-title">Dashboard</h1>

      {dashState.kind === "idle" && (
        <div className="creator-panel">
          <p>Connect your wallet to view your creator dashboard.</p>
          <button type="button" onClick={handleConnect}>
            Connect Wallet
          </button>
          <p className="hint">
            On MiniPay this connects automatically. On desktop, MetaMask works.
          </p>
        </div>
      )}

      {dashState.kind === "loading" && (
        <p className="status">Looking up your handle on {ACTIVE_CHAIN.name}…</p>
      )}

      {dashState.kind === "error" && <p className="error">{dashState.message}</p>}

      {dashState.kind === "not-registered" && (
        <div className="creator-panel">
          <p>
            No handle found for <code>{address ? shortAddr(address) : "your wallet"}</code> on{" "}
            {ACTIVE_CHAIN.name}.
          </p>
          <Link to="/create" className="btn-primary">
            Register your handle
          </Link>
        </div>
      )}

      {dashState.kind === "found" && (() => {
        const profile = decodeMetadata(dashState.metadataURI);
        const displayName = profile?.name || `@${dashState.handle}`;
        const tipUrl = `${window.location.origin}/s/${dashState.handle}`;

        return (
          <>
            <header className="creator-header">
              {profile?.avatar && (
                <img
                  className="creator-avatar"
                  src={profile.avatar}
                  alt={displayName}
                  width={64}
                  height={64}
                />
              )}
              <h2 className="dash-name">{displayName}</h2>
              <p className="hint">
                <code>@{dashState.handle}</code> · {ACTIVE_CHAIN.name} ·{" "}
                <code>{shortAddr(dashState.payoutAddress)}</code>
              </p>
            </header>

            <div className="creator-panel">
              <div>
                <span className="label">Your tip link</span>
                <div className="dash-link-row">
                  <code className="dash-link">{tipUrl}</code>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => copyTipLink(dashState.handle)}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div>
                <span className="label">OBS overlay URL</span>
                <div className="dash-link-row">
                  <code className="dash-link">{`${window.location.origin}/overlay/${dashState.handle}`}</code>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      const url = `${window.location.origin}/overlay/${dashState.handle}`;
                      void navigator.clipboard.writeText(url).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="hint">
                  Add as Browser Source in OBS — alerts appear when tips land on-chain.{" "}
                  <a
                    href={`/overlay/${dashState.handle}?test=1`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Preview →
                  </a>
                </p>
              </div>

              <div className="dash-actions">
                <Link to={`/s/${dashState.handle}`} className="btn-secondary">
                  View tip page
                </Link>
                <Link to={`/s/${dashState.handle}/edit`} className="btn-secondary">
                  Edit profile
                </Link>
              </div>
            </div>

            <TipFeed creatorAddress={dashState.payoutAddress} />
          </>
        );
      })()}
    </main>
  );
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
