import {useCallback, useEffect, useState} from "react";
import {Link, useNavigate, useParams} from "react-router-dom";
import type {Address} from "viem";
import {connectWallet, getWalletClient} from "../lib/wallet";
import {publicClient} from "../lib/publicClient";
import {
  SAWER_REGISTRY_ABI,
  getActiveRegistry,
  handleHash,
} from "../lib/contract";
import {decodeMetadata, encodeMetadata, type CreatorLink} from "../lib/metadata";

const REGISTRY = getActiveRegistry();
const MAX_LINKS = 8;

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

      if (!exists) {
        setPageState({kind: "not-found"});
        return;
      }

      const profile = decodeMetadata(metadataURI);
      setDisplayName(profile?.name ?? "");
      setBio(profile?.bio ?? "");
      setAvatar(profile?.avatar ?? "");
      setLinks(profile?.links ?? []);
      setPageState({kind: "ready", creatorAddress: payoutAddress});
    } catch (err) {
      setPageState({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to load creator.",
      });
    }
  }, [normalized]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCreator();
  }, [loadCreator]);

  async function handleConnectAndCheck() {
    try {
      const wallet = await connectWallet();
      setWalletAddress(wallet.address);

      if (pageState.kind === "ready") {
        const lc = wallet.address.toLowerCase();
        const creator = pageState.creatorAddress.toLowerCase();
        if (lc !== creator) {
          setPageState({kind: "unauthorized", creatorAddress: pageState.creatorAddress});
        }
      }
    } catch (err) {
      setSaveStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Could not connect wallet.",
      });
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
    });

    try {
      const walletClient = getWalletClient();
      setSaveStatus({kind: "saving"});

      const txHash = await walletClient.writeContract({
        account: walletAddress,
        address: REGISTRY.address,
        abi: SAWER_REGISTRY_ABI,
        functionName: "updateMetadata",
        args: [normalized, metadataURI],
      });

      setSaveStatus({kind: "saving", txHash});
      await publicClient.waitForTransactionReceipt({hash: txHash});
      setSaveStatus({kind: "success", txHash});

      setTimeout(() => {
        navigate(`/s/${normalized}`);
      }, 2000);
    } catch (err) {
      setSaveStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Update failed.",
      });
    }
  }

  if (pageState.kind === "loading") {
    return (
      <main className="shell narrow">
        <p className="status">Loading @{normalized}…</p>
      </main>
    );
  }

  if (pageState.kind === "not-found") {
    return (
      <main className="shell narrow">
        <Link to="/" className="back-link">← Back</Link>
        <h1 className="page-title">Handle not found</h1>
        <p className="lede">No creator for <code>@{normalized}</code>.</p>
        <Link to="/create" className="btn-primary">Register this handle</Link>
      </main>
    );
  }

  if (pageState.kind === "error") {
    return (
      <main className="shell narrow">
        <p className="error">{pageState.message}</p>
        <Link to={`/s/${normalized}`}>← Back to tip page</Link>
      </main>
    );
  }

  if (pageState.kind === "unauthorized") {
    return (
      <main className="shell narrow">
        <Link to={`/s/${normalized}`} className="back-link">← Back</Link>
        <h1 className="page-title">Not authorised</h1>
        <p className="lede">
          Only <code>{shortAddr(pageState.creatorAddress)}</code> can edit this profile.
        </p>
        <p className="hint">Connected as <code>{walletAddress ? shortAddr(walletAddress) : "—"}</code></p>
      </main>
    );
  }

  const isConnected = walletAddress !== null;
  const isOwner =
    isConnected && walletAddress.toLowerCase() === pageState.creatorAddress.toLowerCase();
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
          <p className="error">
            Connected as <code>{shortAddr(walletAddress)}</code> — only the creator wallet can edit.
          </p>
          <p className="hint">Creator: <code>{shortAddr(pageState.creatorAddress)}</code></p>
        </div>
      ) : (
        <form className="creator-panel" onSubmit={handleSave}>
          <label>
            <span className="label">Display name</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
              placeholder={normalized}
              maxLength={60}
              disabled={isSaving}
            />
          </label>

          <label>
            <span className="label">Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              placeholder="Tell supporters what you do."
              rows={3}
              maxLength={160}
              disabled={isSaving}
            />
            <p className="hint">{bio.length}/160</p>
          </label>

          <label>
            <span className="label">
              Avatar URL <span className="opt">(optional, https://…)</span>
            </span>
            <input
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://example.com/avatar.png"
              disabled={isSaving}
            />
          </label>

          <div>
            <div className="links-header">
              <span className="label">Links <span className="opt">(up to {MAX_LINKS})</span></span>
              {links.length < MAX_LINKS && (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={addLink}
                  disabled={isSaving}
                >
                  + Add link
                </button>
              )}
            </div>

            {links.length === 0 && (
              <p className="hint">Add YouTube, Twitter, website, or any other link.</p>
            )}

            <div className="links-list">
              {links.map((link, idx) => (
                <div key={idx} className="link-editor-row">
                  <input
                    type="text"
                    placeholder="Label (e.g. YouTube)"
                    value={link.label}
                    onChange={(e) => updateLink(idx, "label", e.target.value.slice(0, 40))}
                    disabled={isSaving}
                    className="link-label-input"
                  />
                  <input
                    type="url"
                    placeholder="https://…"
                    value={link.url}
                    onChange={(e) => updateLink(idx, "url", e.target.value.slice(0, 200))}
                    disabled={isSaving}
                    className="link-url-input"
                  />
                  <button
                    type="button"
                    className="btn-secondary btn-sm link-remove-btn"
                    onClick={() => removeLink(idx)}
                    disabled={isSaving}
                    aria-label="Remove link"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving || saveStatus.kind === "success"}
          >
            {isSaving
              ? "Saving on-chain…"
              : saveStatus.kind === "success"
                ? "✓ Saved"
                : "Save profile"}
          </button>

          {saveStatus.kind === "saving" && saveStatus.txHash && (
            <p className="status">
              Tx:{" "}
              <a
                href={REGISTRY.blockExplorerTx(saveStatus.txHash)}
                target="_blank"
                rel="noreferrer"
              >
                {saveStatus.txHash.slice(0, 10)}…
              </a>
            </p>
          )}

          {saveStatus.kind === "success" && (
            <div className="success-box">
              <p><strong>Profile updated!</strong> Redirecting…</p>
              <a
                href={REGISTRY.blockExplorerTx(saveStatus.txHash)}
                target="_blank"
                rel="noreferrer"
              >
                View on explorer
              </a>
            </div>
          )}

          {saveStatus.kind === "error" && (
            <p className="error">{saveStatus.message}</p>
          )}
        </form>
      )}
    </main>
  );
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
