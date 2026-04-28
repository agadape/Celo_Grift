import {useCallback, useEffect, useState} from "react";
import {Link, useParams} from "react-router-dom";
import {parseUnits, formatUnits, encodeFunctionData, type Address} from "viem";
import {connectWallet, getWalletClient} from "../lib/wallet";
import {publicClient, ACTIVE_CHAIN} from "../lib/publicClient";
import {SAWER_REGISTRY_ABI, getActiveRegistry, handleHash} from "../lib/contract";
import {CrossChainQuote} from "../components/CrossChainQuote";
import {TipFeed, type TipEntry, formatTipAmount} from "../components/TipFeed";
import {decodeMetadata} from "../lib/metadata";
import {CELO_TOKENS, ERC20_ABI} from "../lib/tokens";

const REGISTRY = getActiveRegistry();
const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

const PRESETS_CELO = ["0.1", "0.5", "1", "5"];
const PRESETS_STABLE = ["1", "5", "10", "25"];
const REACTIONS = ["🔥", "❤️", "💎", "🚀", "👑", "⚡", "🎉", "💯"];

type Creator = {payoutAddress: Address; handle: string; metadataURI: string};
type LookupState =
  | {kind: "loading"}
  | {kind: "found"; creator: Creator}
  | {kind: "not-found"}
  | {kind: "error"; message: string};
type TipStatus =
  | {kind: "idle"}
  | {kind: "sending"; step: "transfer" | "receipt"; txHash?: `0x${string}`}
  | {kind: "success"; transferTx: `0x${string}`; receiptTx: `0x${string}`}
  | {kind: "error"; message: string};

function getGoalTokenAddress(symbol: string): string {
  if (symbol === "CELO") return ZERO_ADDRESS;
  const t = CELO_TOKENS.find((x) => x.symbol === symbol && x.address !== "native");
  return t ? (t.address as string) : ZERO_ADDRESS;
}

export function TipPage() {
  const {handle = ""} = useParams();
  const normalized = handle.toLowerCase();

  const [lookup, setLookup] = useState<LookupState>({kind: "loading"});
  const [supporterAddress, setSupporterAddress] = useState<Address | null>(null);
  const [manualAddress, setManualAddress] = useState("");
  const [selectedTokenIdx, setSelectedTokenIdx] = useState(0);
  const [amount, setAmount] = useState("0.1");
  const [message, setMessage] = useState("");
  const [reaction, setReaction] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [tipStatus, setTipStatus] = useState<TipStatus>({kind: "idle"});
  const [loadedTips, setLoadedTips] = useState<TipEntry[] | null>(null);
  const hasInjectedWallet = typeof window !== "undefined" && Boolean(window.ethereum);

  const selectedToken = CELO_TOKENS[selectedTokenIdx] ?? CELO_TOKENS[0];
  const presets = selectedToken.address === "native" ? PRESETS_CELO : PRESETS_STABLE;

  const loadCreator = useCallback(async () => {
    setLookup({kind: "loading"});
    try {
      const result = await publicClient.readContract({
        address: REGISTRY.address,
        abi: SAWER_REGISTRY_ABI,
        functionName: "creatorsByHandle",
        args: [handleHash(normalized)],
      });
      const [payoutAddress, fetchedHandle, metadataURI, exists] = result;
      if (!exists) {setLookup({kind: "not-found"}); return;}
      setLookup({kind: "found", creator: {payoutAddress, handle: fetchedHandle, metadataURI}});
    } catch (err) {
      setLookup({kind: "error", message: err instanceof Error ? err.message : "Failed to load creator."});
    }
  }, [normalized]);

  useEffect(() => { void loadCreator(); }, [loadCreator]);
  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum?.isMiniPay) void handleConnect();
  }, []);
  useEffect(() => {
    if (lookup.kind === "found") {
      const name = decodeMetadata(lookup.creator.metadataURI)?.name || `@${lookup.creator.handle}`;
      document.title = `Tip ${name} · SawerLink`;
    }
    return () => { document.title = "SawerLink"; };
  }, [lookup]);

  function handleTokenChange(idx: number) {
    setSelectedTokenIdx(idx);
    const newPresets = CELO_TOKENS[idx]?.address === "native" ? PRESETS_CELO : PRESETS_STABLE;
    setAmount(newPresets[0]);
    setTipStatus({kind: "idle"});
  }

  async function handleConnect() {
    try {
      const wallet = await connectWallet();
      setSupporterAddress(wallet.address);
    } catch (err) {
      setTipStatus({kind: "error", message: err instanceof Error ? err.message : "Could not connect."});
    }
  }

  async function handleTip(event: React.FormEvent) {
    event.preventDefault();
    if (lookup.kind !== "found" || !supporterAddress) {
      setTipStatus({kind: "error", message: "Connect your wallet first."});
      return;
    }

    let amountParsed: bigint;
    try {
      amountParsed = parseUnits(amount, selectedToken.decimals);
      if (amountParsed <= 0n) throw new Error();
    } catch {
      setTipStatus({kind: "error", message: "Invalid amount."});
      return;
    }

    const fullMessage = reaction ? `${reaction} ${message}`.trim() : message;

    try {
      const walletClient = getWalletClient();
      const ethereum = window.ethereum;
      if (!ethereum) throw new Error("No wallet found.");

      setTipStatus({kind: "sending", step: "transfer"});
      let transferTx: `0x${string}`;

      if (selectedToken.address === "native") {
        transferTx = await walletClient.sendTransaction({
          account: supporterAddress,
          to: lookup.creator.payoutAddress,
          value: amountParsed,
        });
      } else {
        const data = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [lookup.creator.payoutAddress, amountParsed],
        });
        const txParams: Record<string, unknown> = {from: supporterAddress, to: selectedToken.address, data};
        if (selectedToken.feeCurrency) txParams.feeCurrency = selectedToken.feeCurrency;
        transferTx = (await ethereum.request({method: "eth_sendTransaction", params: [txParams]})) as `0x${string}`;
      }

      setTipStatus({kind: "sending", step: "transfer", txHash: transferTx});
      await publicClient.waitForTransactionReceipt({hash: transferTx});

      setTipStatus({kind: "sending", step: "receipt"});
      const tokenAddress: Address = selectedToken.address === "native" ? ZERO_ADDRESS : selectedToken.address;

      const receiptTx = await walletClient.writeContract({
        account: supporterAddress,
        address: REGISTRY.address,
        abi: SAWER_REGISTRY_ABI,
        functionName: "recordTip",
        args: [lookup.creator.handle, tokenAddress, amountParsed, fullMessage.slice(0, 200), ZERO_BYTES32],
      });
      await publicClient.waitForTransactionReceipt({hash: receiptTx});

      setTipStatus({kind: "success", transferTx, receiptTx});
      setMessage("");
      setReaction("");
    } catch (err) {
      setTipStatus({kind: "error", message: err instanceof Error ? err.message : "Tip failed."});
    }
  }

  if (lookup.kind === "loading") return <main className="shell narrow"><p className="status">Looking up @{normalized}…</p></main>;
  if (lookup.kind === "error") return <main className="shell narrow"><p className="error">{lookup.message}</p><Link to="/">← Back home</Link></main>;
  if (lookup.kind === "not-found") return (
    <main className="shell narrow">
      <Link to="/" className="back-link">← Back</Link>
      <h1 className="page-title">Handle not found</h1>
      <p className="lede">No creator registered for <code>@{normalized}</code>.</p>
      <Link to="/create" className="btn-primary">Register this handle</Link>
    </main>
  );

  const {creator} = lookup;
  const profile = decodeMetadata(creator.metadataURI);
  const displayName = profile?.name || `@${creator.handle}`;
  const tipUrl = typeof window !== "undefined" ? `${window.location.origin}/s/${creator.handle}` : "";

  // Goal progress calculation
  const goal = profile?.goal;
  const goalTokenAddr = goal ? getGoalTokenAddress(goal.token) : "";
  const goalTarget = goal ? parseFloat(goal.target) : 0;
  const goalToken = goal ? CELO_TOKENS.find((t) => t.symbol === goal.token) : null;
  const goalDecimals = goalToken && goalToken.address !== "native" ? goalToken.decimals : 18;
  const goalCurrentRaw = loadedTips
    ? loadedTips
        .filter((t) => t.token.toLowerCase() === goalTokenAddr.toLowerCase())
        .reduce((sum, t) => sum + t.amount, 0n)
    : null;
  const goalCurrent = goalCurrentRaw !== null ? parseFloat(formatUnits(goalCurrentRaw, goalDecimals)) : null;
  const goalPct = goal && goalCurrent !== null && goalTarget > 0
    ? Math.min(100, (goalCurrent / goalTarget) * 100)
    : null;

  // Top tips leaderboard
  const topTips = loadedTips
    ? [...loadedTips].sort((a, b) => (b.amount > a.amount ? 1 : -1)).slice(0, 5)
    : null;

  return (
    <main className="shell narrow">
      <Link to="/" className="back-link">← Back</Link>

      <header className="creator-header">
        {profile?.avatar && (
          <img className="creator-avatar" src={profile.avatar} alt={displayName} width={64} height={64} />
        )}
        <p className="eyebrow">SawerLink</p>
        <h1 className="page-title">{displayName}</h1>
        {profile?.bio && <p className="creator-bio">{profile.bio}</p>}

        {profile?.links && profile.links.length > 0 && (
          <div className="creator-links">
            {profile.links.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noreferrer" className="creator-link-btn">
                {link.label}
              </a>
            ))}
          </div>
        )}

        <div className="creator-meta-row">
          <p className="lede"><code>@{creator.handle}</code> · <code>{shortAddr(creator.payoutAddress)}</code></p>
          <div className="creator-meta-actions">
            <button type="button" className="btn-secondary btn-sm" onClick={() => setShowQR(!showQR)}>
              {showQR ? "Hide QR" : "QR Code"}
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => void navigator.clipboard.writeText(tipUrl)}
            >
              Copy link
            </button>
          </div>
        </div>

        {showQR && (
          <div className="qr-wrapper">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(tipUrl)}&bgcolor=ffffff&color=0f2d1e&margin=10`}
              alt="QR code for tip page"
              width={200}
              height={200}
              className="qr-image"
            />
            <p className="hint">Scan to open tip page</p>
          </div>
        )}

        <Link to={`/s/${creator.handle}/edit`} className="edit-profile-link">Edit profile</Link>
      </header>

      {/* Tip goal */}
      {goal && goalPct !== null && (
        <div className="tip-goal">
          <div className="tip-goal-header">
            <span className="tip-goal-label">🎯 {goal.label}</span>
            <span className="tip-goal-progress-text">
              {goalCurrent?.toFixed(2)} / {goalTarget} {goal.token}
            </span>
          </div>
          <div className="tip-goal-bar-track">
            <div className="tip-goal-bar-fill" style={{width: `${goalPct}%`}} />
          </div>
          {goalPct >= 100 && <p className="hint tip-goal-complete">🎉 Goal reached!</p>}
        </div>
      )}

      <form className="creator-panel" onSubmit={handleTip}>
        {!supporterAddress ? (
          <>
            <p>Connect a wallet to tip @{creator.handle}.</p>
            {hasInjectedWallet ? (
              <button type="button" onClick={handleConnect}>Connect Wallet</button>
            ) : (
              <div className="no-wallet-fallback">
                <p className="hint">No wallet detected. Paste your Celo address below.</p>
                <input
                  type="text"
                  placeholder="0x… your Celo address"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value.trim())}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (/^0x[0-9a-fA-F]{40}$/.test(manualAddress)) {
                      setSupporterAddress(manualAddress as Address);
                    } else {
                      setTipStatus({kind: "error", message: "Enter a valid 0x Celo address."});
                    }
                  }}
                >
                  Use this address
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <span className="label">Tipping from</span>
              <code>{shortAddr(supporterAddress)}</code>
            </div>

            <label>
              <span className="label">Token</span>
              <select
                value={selectedTokenIdx}
                onChange={(e) => handleTokenChange(Number(e.target.value))}
                disabled={tipStatus.kind === "sending"}
              >
                {CELO_TOKENS.map((t, i) => (
                  <option key={t.symbol} value={i}>
                    {t.symbol}{t.feeCurrency ? " (pay gas in token)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="label">Amount ({selectedToken.symbol})</span>
              <div className="amount-presets">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={amount === preset ? "preset active" : "preset"}
                    onClick={() => setAmount(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                type="number"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={tipStatus.kind === "sending"}
              />
            </label>

            <div>
              <span className="label">Reaction <span className="opt">(optional)</span></span>
              <div className="emoji-row">
                {REACTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className={reaction === e ? "emoji-btn active" : "emoji-btn"}
                    onClick={() => setReaction(reaction === e ? "" : e)}
                    disabled={tipStatus.kind === "sending"}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <label>
              <span className="label">Message <span className="opt">(optional)</span></span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 200))}
                placeholder="Thanks for streaming!"
                rows={2}
                maxLength={200}
                disabled={tipStatus.kind === "sending"}
              />
              <p className="hint">{message.length}/200</p>
            </label>

            <button type="submit" disabled={tipStatus.kind === "sending" || tipStatus.kind === "success"}>
              {tipStatus.kind === "sending"
                ? tipStatus.step === "transfer" ? `Sending ${selectedToken.symbol}…` : "Logging receipt…"
                : tipStatus.kind === "success"
                  ? "✓ Sent"
                  : `Send ${amount} ${selectedToken.symbol}`}
            </button>

            {tipStatus.kind === "sending" && (
              <p className="hint">
                Step {tipStatus.step === "transfer" ? "1" : "2"} of 2:{" "}
                {tipStatus.step === "transfer" ? `transferring ${selectedToken.symbol}` : "logging on-chain receipt"}.
              </p>
            )}

            {tipStatus.kind === "success" && (
              <div className="success-box">
                <p><strong>Tip sent!</strong></p>
                <a href={REGISTRY.blockExplorerTx(tipStatus.transferTx)} target="_blank" rel="noreferrer">View transfer</a>
                {" · "}
                <a href={REGISTRY.blockExplorerTx(tipStatus.receiptTx)} target="_blank" rel="noreferrer">View receipt</a>
              </div>
            )}
            {tipStatus.kind === "error" && <p className="error">{tipStatus.message}</p>}
          </>
        )}
      </form>

      <CrossChainQuote supporterAddress={supporterAddress} creatorAddress={creator.payoutAddress} creatorHandle={creator.handle} />

      {/* Leaderboard */}
      {topTips && topTips.length > 0 && (
        <div className="leaderboard">
          <p className="label">🏆 Top tips</p>
          <ul className="leaderboard-list">
            {topTips.map((tip, i) => (
              <li key={tip.txHash} className="leaderboard-item">
                <span className="leaderboard-rank">#{i + 1}</span>
                <span className="leaderboard-amount">{formatTipAmount(tip.amount)} CELO</span>
                {tip.message && <span className="leaderboard-msg">"{tip.message.slice(0, 60)}"</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <TipFeed creatorAddress={creator.payoutAddress} onTipsLoaded={setLoadedTips} />

      <p className="hint center">
        Network: {ACTIVE_CHAIN.name} ·{" "}
        <a href={REGISTRY.explorer} target="_blank" rel="noreferrer">{shortAddr(REGISTRY.address)}</a>
      </p>
    </main>
  );
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
