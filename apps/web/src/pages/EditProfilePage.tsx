import {useCallback, useEffect, useState} from "react";
import {Link, useNavigate, useParams} from "react-router-dom";
import type {Address} from "viem";
import {connectWallet, getWalletClient} from "../lib/wallet";
import {publicClient} from "../lib/publicClient";
import {SAWER_REGISTRY_ABI, getActiveRegistry, handleHash} from "../lib/contract";
import {decodeMetadata, encodeMetadata, type CreatorLink} from "../lib/metadata";
import {CELO_TOKENS} from "../lib/tokens";

const REGISTRY = getActiveRegistry();
const MAX_LINKS = 8;
const GOAL_TOKENS = CELO_TOKENS.map((t) => t.symbol);

type PageState =
  | {kind: "loading"}
  | {kind: "not-found"}
  | {kind: "unauthorized"; creatorAddress: Address}
  | {kind: "ready"; creatorAddress: Address}
  | {kind: "error"; message: string};

type SaveStatus =
  | {kind: "idle"}
  | {kind: "saving"; txHash?: `0x${string}`}
  | {kind: "success"; txHash: `0x${string}`}
  | {kind: "error"; message: string};

export function EditProfilePage() {
  const {handle = ""} = useParams();
  const normalized = handle.toLowerCase();
  const navigate = useNavigate();

  const [pageState, setPageState] = useState<PageState>({kind: "loading"});
  const [walletAddress, setWalletAddress] = useState<Address | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [links, setLinks] = useState<CreatorLink[]>([]);
  const [goalEnabled, setGoalEnabled] = useState(false);
  const [goalLabel, setGoalLabel] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalToken, setGoalToken] = useState("CELO");
  const [subEnabled, setSubEnabled] = useState(false);
  const [subPrice, setSubPrice] = useState("1");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({kind: "idle"});

  const loadCreator = useCallback(async () => {
    try {
      const result = await publicClient.readContract({
        address: REGISTRY.address,
        abi: SAWER_REGISTRY_ABI,
        functionName: "creatorsByHandle",
        args: [handleHash(normalized)],
      });
      const [payoutAddress, , metadataURI, exists] = result;
      if (!exists) {setPageState({kind: "not-found"}); return;}

      const profile = decodeMetadata(metadataURI);
      setDisplayName(profile?.name ?? "");
      setBio(profile?.bio ?? "");
      setAvatar(profile?.avatar ?? "");
      setLinks(profile?.links ?? []);
      if (profile?.goal) {
        setGoalEnabled(true);
        setGoalLabel(profile.goal.label);
        setGoalTarget(profile.goal.target);
        setGoalToken(profile.goal.token);
      }
      setPageState({kind: "ready", creatorAddress: payoutAddress});

      // Load existing subscription config (graceful — new contract feature)
      try {
        const cfg = await publicClient.readContract({
          address: REGISTRY.address,
          abi: SAWER_REGISTRY_ABI,
          functionName: "subConfigs",
          args: [handleHash(normalized)],
        });
        setSubEnabled(cfg[0]);
        if (cfg[1] > 0n) {
          const {formatUnits} = await import("viem");
          setSubPrice(parseFloat(formatUnits(cfg[1], 18)).toString());
        }
      } catch { /* subscription not on this contract version */ }
    } catch (err) {
      setPageState({kind: "error", message: err instanceof Error ? err.message : "Failed to load creator."});
    }
  }, [normalized]);

  useEffect(() => { void loadCreator(); }, [loadCreator]);

  async function handleConnectAndCheck() {
    try {
      const wallet = await connectWallet();
      setWalletAddress(wallet.address);
      if (pageState.kind === "ready" && wallet.address.toLowerCase() !== pageState.creatorAddress.toLowerCase()) {
        setPageState({kind: "unauthorized", creatorAddress: pageState.creatorAddress});
      }
    } catch (err) {
      setSaveStatus({kind: "error", message: err instanceof Error ? err.message : "Could not connect wallet."});
    }
  }

  function addLink() {
    if (links.length >= MAX_LINKS) return;
    setLinks([...links, {label: "", url: ""}]);
  }
  function updateLink(idx: number, field: keyof CreatorLink, value: string) {
    setLinks(links.map((l, i) => (i === idx ? {...l, [field]: value} : l)));
  }
  function removeLink(idx: number) {
    setLinks(links.filter((_, i) => i !== idx));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (pageState.kind !== "ready" || !walletAddress) return;
    if (walletAddress.toLowerCase() !== pageState.creatorAddress.toLowerCase()) {
      setSaveStatus({kind: "error", message: "Only the registered creator can edit this profile."});
      return;
    }

    const cleanedLinks = links
      .map((l) => ({label: l.label.trim(), url: l.url.trim()}))
      .filter((l) => l.label && l.url);

    const metadataURI = encodeMetadata({
      name: displayName.trim() || normalized,
      bio: bio.trim(),
      avatar: avatar.trim(),
      links: cleanedLinks,
      goal: goalEnabled && goalLabel.trim() && goalTarget.trim()
        ? {label: goalLabel.trim(), target: goalTarget.trim(), token: goalToken}
        : undefined,
    });

    try {
      const {parseUnits} = await import("viem");
      const walletClient = getWalletClient();
      setSaveStatus({kind: "saving"});

      // Save metadata
      const txHash = await walletClient.writeContract({
        account: walletAddress,
        address: REGISTRY.address,
        abi: SAWER_REGISTRY_ABI,
        functionName: "updateMetadata",
        args: [normalized, metadataURI],
      });
      setSaveStatus({kind: "saving", txHash});
      await publicClient.waitForTransactionReceipt({hash: txHash});

      // Save subscription config (separate tx — graceful if contract doesn't support it)
      try {
        const priceWei = subEnabled && subPrice.trim()
          ? parseUnits(subPrice.trim(), 18)
          : 0n;
        const subTx = await walletClient.writeContract({
          account: walletAddress,
          address: REGISTRY.address,
          abi: SAWER_REGISTRY_ABI,
          functionName: "setSubConfig",
          args: [normalized, subEnabled, priceWei],
        });
        await publicClient.waitForTransactionReceipt({hash: subTx});
      } catch { /* setSubConfig not available on older contract */ }
      setSaveStatus({kind: "success", txHash});
      setTimeout(() => navigate(`/s/${normalized}`), 2000);
    } catch (err) {
      setSaveStatus({kind: "error", message: err instanceof Error ? err.message : "Update failed."});
    }
  }

  if (pageState.kind === "loading") return <main className="shell narrow"><p className="status">Loading @{normalized}…</p></main>;
  if (pageState.kind === "not-found") return (
    <main className="shell narrow">
      <Link to="/" className="back-link">← Back</Link>
      <h1 className="page-title">Handle not found</h1>
      <p className="lede">No creator for <code>@{normalized}</code>.</p>
      <Link to="/create" className="btn-primary">Register this handle</Link>
    </main>
  );
  if (pageState.kind === "error") return (
    <main className="shell narrow">
      <p className="error">{pageState.message}</p>
      <Link to={`/s/${normalized}`}>← Back to tip page</Link>
    </main>
  );
  if (pageState.kind === "unauthorized") return (
    <main className="shell narrow">
      <Link to={`/s/${normalized}`} className="back-link">← Back</Link>
      <h1 className="page-title">Not authorised</h1>
      <p className="lede">Only <code>{shortAddr(pageState.creatorAddress)}</code> can edit this profile.</p>
      <p className="hint">Connected as <code>{walletAddress ? shortAddr(walletAddress) : "—"}</code></p>
    </main>
  );

  const isConnected = walletAddress !== null;
  const isOwner = isConnected && walletAddress.toLowerCase() === pageState.creatorAddress.toLowerCase();
  const isSaving = saveStatus.kind === "saving";

  return (
    <main className="shell narrow">
      <Link to={`/s/${normalized}`} className="back-link">← Back to tip page</Link>
      <h1 className="page-title">Edit profile</h1>
      <p className="lede"><code>@{normalized}</code></p>

      {!isConnected ? (
        <div className="creator-panel">
          <p>Connect the wallet registered to <code>@{normalized}</code> to edit this profile.</p>
          <button type="button" onClick={handleConnectAndCheck}>Connect Wallet</button>
        </div>
      ) : !isOwner ? (
        <div className="creator-panel">
          <p className="error">Connected as <code>{shortAddr(walletAddress)}</code> — only the creator wallet can edit.</p>
          <p className="hint">Creator: <code>{shortAddr(pageState.creatorAddress)}</code></p>
        </div>
      ) : (
        <form className="creator-panel" onSubmit={handleSave}>
          <label>
            <span className="label">Display name</span>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value.slice(0, 60))} placeholder={normalized} maxLength={60} disabled={isSaving} />
          </label>

          <label>
            <span className="label">Bio</span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 160))} placeholder="Tell supporters what you do." rows={3} maxLength={160} disabled={isSaving} />
            <p className="hint">{bio.length}/160</p>
          </label>

          <label>
            <span className="label">Avatar URL <span className="opt">(optional, https://…)</span></span>
            <input type="url" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://example.com/avatar.png" disabled={isSaving} />
          </label>

          {/* Links */}
          <div>
            <div className="links-header">
              <span className="label">Links <span className="opt">(up to {MAX_LINKS})</span></span>
              {links.length < MAX_LINKS && (
                <button type="button" className="btn-secondary btn-sm" onClick={addLink} disabled={isSaving}>+ Add link</button>
              )}
            </div>
            {links.length === 0 && <p className="hint">Add YouTube, Twitter, website, or any other link.</p>}
            <div className="links-list">
              {links.map((link, idx) => (
                <div key={idx} className="link-editor-row">
                  <input type="text" placeholder="Label" value={link.label} onChange={(e) => updateLink(idx, "label", e.target.value.slice(0, 40))} disabled={isSaving} className="link-label-input" />
                  <input type="url" placeholder="https://…" value={link.url} onChange={(e) => updateLink(idx, "url", e.target.value.slice(0, 200))} disabled={isSaving} className="link-url-input" />
                  <button type="button" className="btn-secondary btn-sm link-remove-btn" onClick={() => removeLink(idx)} disabled={isSaving} aria-label="Remove">✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* Tip Goal */}
          <div>
            <div className="links-header">
              <span className="label">Tip goal <span className="opt">(optional)</span></span>
              <label className="goal-toggle">
                <input type="checkbox" checked={goalEnabled} onChange={(e) => setGoalEnabled(e.target.checked)} disabled={isSaving} />
                <span>{goalEnabled ? "Enabled" : "Disabled"}</span>
              </label>
            </div>
            {goalEnabled && (
              <div className="goal-editor">
                <input
                  type="text"
                  placeholder="Goal label (e.g. New microphone)"
                  value={goalLabel}
                  onChange={(e) => setGoalLabel(e.target.value.slice(0, 80))}
                  disabled={isSaving}
                />
                <div className="goal-amount-row">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Target amount"
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    disabled={isSaving}
                    className="goal-amount-input"
                  />
                  <select value={goalToken} onChange={(e) => setGoalToken(e.target.value)} disabled={isSaving} className="goal-token-select">
                    {GOAL_TOKENS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <p className="hint">Progress bar appears on your tip page once tips start arriving.</p>
              </div>
            )}
          </div>

          {/* Monthly Subscription */}
          <div className="sub-config-section">
            <div className="links-header">
              <span className="label">Monthly subscription <span className="opt">(optional)</span></span>
              <label className="goal-toggle">
                <input type="checkbox" checked={subEnabled} onChange={(e) => setSubEnabled(e.target.checked)} disabled={isSaving} />
                <span>{subEnabled ? "Enabled" : "Disabled"}</span>
              </label>
            </div>
            {subEnabled && (
              <div className="sub-config-editor">
                <div className="goal-amount-row">
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="Monthly price"
                    value={subPrice}
                    onChange={(e) => setSubPrice(e.target.value)}
                    disabled={isSaving}
                    className="goal-amount-input"
                  />
                  <span className="sub-token-label">CELO / month</span>
                </div>
                <p className="hint">Subscribers pay in native CELO. They get a subscriber badge on their tips and any perks you offer.</p>
              </div>
            )}
          </div>

          <button type="submit" disabled={isSaving || saveStatus.kind === "success"}>
            {isSaving ? "Saving on-chain…" : saveStatus.kind === "success" ? "✓ Saved" : "Save profile"}
          </button>

          {saveStatus.kind === "saving" && saveStatus.txHash && (
            <p className="status">Tx: <a href={REGISTRY.blockExplorerTx(saveStatus.txHash)} target="_blank" rel="noreferrer">{saveStatus.txHash.slice(0, 10)}…</a></p>
          )}
          {saveStatus.kind === "success" && (
            <div className="success-box">
              <p><strong>Profile updated!</strong> Redirecting…</p>
              <a href={REGISTRY.blockExplorerTx(saveStatus.txHash)} target="_blank" rel="noreferrer">View on explorer</a>
            </div>
          )}
          {saveStatus.kind === "error" && <p className="error">{saveStatus.message}</p>}
        </form>
      )}
    </main>
  );
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
