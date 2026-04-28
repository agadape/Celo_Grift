import {useEffect, useState} from "react";
import {Link, useNavigate} from "react-router-dom";
import type {Address} from "viem";
import {connectWallet, getWalletClient} from "../lib/wallet";
import {publicClient, ACTIVE_CHAIN} from "../lib/publicClient";
import {
  SAWER_REGISTRY_ABI,
  getActiveRegistry,
  handleHash,
} from "../lib/contract";
import {encodeMetadata} from "../lib/metadata";

const REGISTRY = getActiveRegistry();
const HANDLE_REGEX = /^[a-z0-9-]{3,20}$/;

type AvailState = "idle" | "checking" | "available" | "taken" | "invalid-format";

type Status =
  | {kind: "idle"}
  | {kind: "submitting"; txHash?: `0x${string}`}
  | {kind: "success"; handle: string; txHash: `0x${string}`}
  | {kind: "error"; message: string};

export function CreatePage() {
  const navigate = useNavigate();
  const [address, setAddress] = useState<Address | null>(null);
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [availState, setAvailState] = useState<AvailState>("idle");
  const [status, setStatus] = useState<Status>({kind: "idle"});

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum?.isMiniPay) {
      void handleConnect();
    }
  }, []);

  // Debounced live availability check
  useEffect(() => {
    const normalized = handle.trim().toLowerCase();
    if (!normalized) {
      setAvailState("idle");
      return;
    }
    if (!HANDLE_REGEX.test(normalized)) {
      setAvailState("invalid-format");
      return;
    }

    const timer = setTimeout(async () => {
      setAvailState("checking");
      try {
        const result = await publicClient.readContract({
          address: REGISTRY.address,
          abi: SAWER_REGISTRY_ABI,
          functionName: "creatorsByHandle",
          args: [handleHash(normalized)],
        });
        setAvailState(result[3] ? "taken" : "available");
      } catch {
        setAvailState("idle");
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [handle]);

  async function handleConnect() {
    try {
      const wallet = await connectWallet();
      setAddress(wallet.address);
      setIsMiniPay(wallet.isMiniPay);
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Could not connect wallet.",
      });
    }
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();

    if (!address) {
      setStatus({kind: "error", message: "Connect your wallet first."});
      return;
    }

    const normalized = handle.trim().toLowerCase();
    if (!HANDLE_REGEX.test(normalized)) {
      setStatus({
        kind: "error",
        message: "Handle must be 3–20 chars, lowercase letters, numbers, or hyphens.",
      });
      return;
    }

    if (availState === "taken") {
      setStatus({kind: "error", message: `Handle "${normalized}" is already taken.`});
      return;
    }

    // If not yet confirmed available, do a final check
    if (availState !== "available") {
      try {
        const existing = await publicClient.readContract({
          address: REGISTRY.address,
          abi: SAWER_REGISTRY_ABI,
          functionName: "creatorsByHandle",
          args: [handleHash(normalized)],
        });
        if (existing[3]) {
          setStatus({kind: "error", message: `Handle "${normalized}" is already taken.`});
          setAvailState("taken");
          return;
        }
      } catch (err) {
        setStatus({
          kind: "error",
          message: err instanceof Error ? err.message : "Could not verify handle.",
        });
        return;
      }
    }

    const metadataURI = encodeMetadata({
      name: displayName.trim() || normalized,
      bio: bio.trim(),
      avatar: "",
      links: [],
    });

    const walletClient = getWalletClient();
    setStatus({kind: "submitting"});

    try {
      const txHash = await walletClient.writeContract({
        account: address,
        address: REGISTRY.address,
        abi: SAWER_REGISTRY_ABI,
        functionName: "registerCreator",
        args: [normalized, metadataURI],
      });

      setStatus({kind: "submitting", txHash});
      await publicClient.waitForTransactionReceipt({hash: txHash});
      setStatus({kind: "success", handle: normalized, txHash});

      setTimeout(() => {
        navigate(`/s/${normalized}`);
      }, 2500);
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Registration failed.",
      });
    }
  }

  const isSubmitting = status.kind === "submitting";

  return (
    <main className="shell narrow">
      <Link to="/" className="back-link">
        ← Back
      </Link>

      <h1 className="page-title">Create your SawerLink</h1>
      <p className="lede">
        Reserve a handle on {ACTIVE_CHAIN.name}. Your wallet becomes the payout address.
      </p>

      {!address ? (
        <div className="creator-panel">
          <p>Connect a wallet to register a handle.</p>
          <button type="button" onClick={handleConnect}>
            Connect Wallet
          </button>
          <p className="hint">
            Inside MiniPay this connects automatically. On desktop, MetaMask works.
          </p>
        </div>
      ) : (
        <form className="creator-panel" onSubmit={handleRegister}>
          <div>
            <span className="label">Connected wallet</span>
            <code>{address}</code>
            {isMiniPay && <span className="badge">MiniPay</span>}
          </div>

          <label>
            <span className="label">Handle</span>
            <div className="handle-input">
              <span>sawerlink.app/s/</span>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="yourname"
                disabled={isSubmitting || status.kind === "success"}
                autoComplete="off"
                spellCheck={false}
              />
              {availState === "checking" && (
                <span className="avail-indicator avail-loading">…</span>
              )}
              {availState === "available" && (
                <span className="avail-indicator avail-ok">✓</span>
              )}
              {availState === "taken" && (
                <span className="avail-indicator avail-no">✗</span>
              )}
            </div>
            {availState === "available" && (
              <p className="hint avail-hint-ok">Available!</p>
            )}
            {availState === "taken" && (
              <p className="hint avail-hint-no">Already taken — try another.</p>
            )}
            {availState === "invalid-format" && handle.trim().length > 0 && (
              <p className="hint">3–20 lowercase letters, numbers, or hyphens.</p>
            )}
            {availState === "idle" && (
              <p className="hint">3–20 lowercase letters, numbers, or hyphens.</p>
            )}
          </label>

          <label>
            <span className="label">
              Display name <span className="opt">(optional)</span>
            </span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
              placeholder="Your Name"
              disabled={isSubmitting || status.kind === "success"}
              maxLength={60}
            />
          </label>

          <label>
            <span className="label">
              Bio <span className="opt">(optional)</span>
            </span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              placeholder="I make videos, stream, and build stuff."
              rows={2}
              maxLength={160}
              disabled={isSubmitting || status.kind === "success"}
            />
            <p className="hint">{bio.length}/160</p>
          </label>

          <button
            type="submit"
            disabled={
              isSubmitting ||
              status.kind === "success" ||
              availState === "taken" ||
              availState === "invalid-format" ||
              availState === "checking"
            }
          >
            {isSubmitting
              ? "Registering on-chain…"
              : status.kind === "success"
                ? "✓ Registered"
                : "Register handle"}
          </button>

          {status.kind === "submitting" && status.txHash && (
            <p className="status">
              Tx submitted:{" "}
              <a
                href={REGISTRY.blockExplorerTx(status.txHash)}
                target="_blank"
                rel="noreferrer"
              >
                {status.txHash.slice(0, 10)}…
              </a>
            </p>
          )}

          {status.kind === "success" && (
            <div className="success-box">
              <p>
                <strong>Registered!</strong> Redirecting to your tip page…
              </p>
              <a
                href={REGISTRY.blockExplorerTx(status.txHash)}
                target="_blank"
                rel="noreferrer"
              >
                View on explorer
              </a>
            </div>
          )}

          {status.kind === "error" && <p className="error">{status.message}</p>}
        </form>
      )}
    </main>
  );
}
