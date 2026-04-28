import {useEffect, useState} from "react";
import {Link} from "react-router-dom";
import {type Address} from "viem";
import {connectWallet} from "../lib/wallet";
import {publicClient, ACTIVE_CHAIN} from "../lib/publicClient";
import {SAWER_REGISTRY_ABI, getActiveRegistry, handleHash} from "../lib/contract";
import {TipFeed} from "../components/TipFeed";
import {decodeMetadata} from "../lib/metadata";

const REGISTRY = getActiveRegistry();

const OV_POSITIONS = [
  {value: "bottom-center", label: "Bottom Center"},
  {value: "bottom-left",   label: "Bottom Left"},
  {value: "bottom-right",  label: "Bottom Right"},
  {value: "top-left",      label: "Top Left"},
  {value: "top-right",     label: "Top Right"},
];

type DashState =
  | {kind: "idle"}
  | {kind: "loading"}
  | {kind: "found"; handle: string; payoutAddress: Address; metadataURI: string}
  | {kind: "not-registered"}
  | {kind: "error"; message: string};

export function DashboardPage() {
  const [address, setAddress] = useState<Address | null>(null);
  const [dashState, setDashState] = useState<DashState>({kind: "idle"});
  const [copied, setCopied] = useState<string | null>(null);

  // Overlay config
  const [ovPos, setOvPos] = useState("bottom-center");
  const [ovAccent, setOvAccent] = useState("#35d07f");
  const [ovDur, setOvDur] = useState(7);

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum?.isMiniPay) void handleConnect();
  }, []);

  async function handleConnect() {
    try {
      const wallet = await connectWallet();
      setAddress(wallet.address);
      await loadDashboard(wallet.address);
    } catch (err) {
      setDashState({kind: "error", message: err instanceof Error ? err.message : "Could not connect."});
    }
  }

  async function loadDashboard(addr: Address) {
    setDashState({kind: "loading"});
    try {
      const logs = await publicClient.getLogs({
        address: REGISTRY.address,
        event: SAWER_REGISTRY_ABI.find((x) => x.type === "event" && x.name === "CreatorRegistered") as (typeof SAWER_REGISTRY_ABI)[number] & {type: "event"},
        args: {creator: addr},
        fromBlock: REGISTRY.deployBlock,
        toBlock: "latest",
      });

      if (logs.length === 0) {setDashState({kind: "not-registered"}); return;}

      const log = logs[logs.length - 1];
      const registeredHandle = (log.args as {handle?: string}).handle ?? "";

      const result = await publicClient.readContract({
        address: REGISTRY.address,
        abi: SAWER_REGISTRY_ABI,
        functionName: "creatorsByHandle",
        args: [handleHash(registeredHandle)],
      });

      if (!result[3]) {setDashState({kind: "not-registered"}); return;}

      setDashState({kind: "found", handle: registeredHandle, payoutAddress: result[0], metadataURI: result[2]});
    } catch (err) {
      setDashState({kind: "error", message: err instanceof Error ? err.message : "Failed to load dashboard."});
    }
  }

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function buildOverlayUrl(handle: string) {
    const base = `${window.location.origin}/overlay/${handle}`;
    const accent = ovAccent.replace("#", "");
    return `${base}?pos=${ovPos}&accent=${accent}&dur=${ovDur}`;
  }

  return (
    <main className="shell narrow">
      <Link to="/" className="back-link">← Back</Link>
      <h1 className="page-title">Dashboard</h1>

      {dashState.kind === "idle" && (
        <div className="creator-panel">
          <p>Connect your wallet to view your creator dashboard.</p>
          <button type="button" onClick={handleConnect}>Connect Wallet</button>
          <p className="hint">On MiniPay this connects automatically. On desktop, MetaMask works.</p>
        </div>
      )}
      {dashState.kind === "loading" && <p className="status">Looking up your handle on {ACTIVE_CHAIN.name}…</p>}
      {dashState.kind === "error" && <p className="error">{dashState.message}</p>}
      {dashState.kind === "not-registered" && (
        <div className="creator-panel">
          <p>No handle found for <code>{address ? shortAddr(address) : "your wallet"}</code> on {ACTIVE_CHAIN.name}.</p>
          <Link to="/create" className="btn-primary">Register your handle</Link>
        </div>
      )}

      {dashState.kind === "found" && (() => {
        const profile = decodeMetadata(dashState.metadataURI);
        const displayName = profile?.name || `@${dashState.handle}`;
        const tipUrl = `${window.location.origin}/s/${dashState.handle}`;
        const overlayUrl = buildOverlayUrl(dashState.handle);
        const embedCode = `<iframe src="${tipUrl}" width="420" height="700" frameborder="0" style="border:none;border-radius:12px;" title="Tip ${displayName}"></iframe>`;

        return (
          <>
            <header className="creator-header">
              {profile?.avatar && <img className="creator-avatar" src={profile.avatar} alt={displayName} width={64} height={64} />}
              <h2 className="dash-name">{displayName}</h2>
              <p className="hint"><code>@{dashState.handle}</code> · {ACTIVE_CHAIN.name} · <code>{shortAddr(dashState.payoutAddress)}</code></p>
            </header>

            {/* Tip link */}
            <div className="creator-panel">
              <div>
                <span className="label">Your tip link</span>
                <div className="dash-link-row">
                  <code className="dash-link">{tipUrl}</code>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => copy(tipUrl, "tip")}>
                    {copied === "tip" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="dash-actions">
                <Link to={`/s/${dashState.handle}`} className="btn-secondary">View tip page</Link>
                <Link to={`/s/${dashState.handle}/edit`} className="btn-secondary">Edit profile</Link>
              </div>
            </div>

            {/* OBS Overlay */}
            <div className="creator-panel">
              <span className="label">OBS stream overlay</span>

              <div className="overlay-config">
                <label className="ov-config-row">
                  <span>Position</span>
                  <select value={ovPos} onChange={(e) => setOvPos(e.target.value)}>
                    {OV_POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </label>
                <label className="ov-config-row">
                  <span>Accent color</span>
                  <div className="ov-color-row">
                    <input type="color" value={ovAccent} onChange={(e) => setOvAccent(e.target.value)} className="ov-color-input" />
                    <code>{ovAccent}</code>
                  </div>
                </label>
                <label className="ov-config-row">
                  <span>Alert duration</span>
                  <div className="ov-duration-row">
                    <input type="range" min={3} max={15} value={ovDur} onChange={(e) => setOvDur(Number(e.target.value))} className="ov-duration-slider" />
                    <span>{ovDur}s</span>
                  </div>
                </label>
              </div>

              <div className="dash-link-row">
                <code className="dash-link">{overlayUrl}</code>
                <button type="button" className="btn-secondary btn-sm" onClick={() => copy(overlayUrl, "overlay")}>
                  {copied === "overlay" ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="hint">
                Add as Browser Source in OBS (1920×1080, transparent bg).{" "}
                <a href={`${overlayUrl}&test=1`} target="_blank" rel="noreferrer">Preview →</a>
              </p>
            </div>

            {/* Embed widget */}
            <div className="creator-panel">
              <span className="label">Embed on your site</span>
              <textarea
                readOnly
                value={embedCode}
                rows={3}
                className="embed-code"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
              <button type="button" className="btn-secondary btn-sm" onClick={() => copy(embedCode, "embed")} style={{width: "fit-content"}}>
                {copied === "embed" ? "Copied!" : "Copy snippet"}
              </button>
              <p className="hint">Paste into your website, blog, or stream description.</p>
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
