import {useCallback, useEffect, useState} from "react";
import {Link, useParams} from "react-router-dom";
import {parseUnits, encodeFunctionData, type Address} from "viem";
import {connectWallet, getWalletClient} from "../lib/wallet";
import {publicClient, ACTIVE_CHAIN} from "../lib/publicClient";
import {
  SAWER_REGISTRY_ABI,
  getActiveRegistry,
  handleHash,
} from "../lib/contract";
import {CrossChainQuote} from "../components/CrossChainQuote";
import {TipFeed} from "../components/TipFeed";
import {decodeMetadata} from "../lib/metadata";
import {CELO_TOKENS, ERC20_ABI} from "../lib/tokens";

const REGISTRY = getActiveRegistry();
const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

const PRESETS_CELO = ["0.1", "0.5", "1", "5"];
const PRESETS_STABLE = ["1", "5", "10", "25"];

type Creator = {
  payoutAddress: Address;
  handle: string;
  metadataURI: string;
};

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

export function TipPage() {
  const {handle = ""} = useParams();
  const normalized = handle.toLowerCase();

  const [lookup, setLookup] = useState<LookupState>({kind: "loading"});
  const [supporterAddress, setSupporterAddress] = useState<Address | null>(null);
  const [manualAddress, setManualAddress] = useState("");
  const [selectedTokenIdx, setSelectedTokenIdx] = useState(0);
  const [amount, setAmount] = useState("0.1");
  const [message, setMessage] = useState("");
  const [tipStatus, setTipStatus] = useState<TipStatus>({kind: "idle"});
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

      if (!exists) {
        setLookup({kind: "not-found"});
        return;
      }

      setLookup({
        kind: "found",
        creator: {payoutAddress, handle: fetchedHandle, metadataURI},
      });
    } catch (err) {
      setLookup({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to load creator.",
      });
    }
  }, [normalized]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCreator();
  }, [loadCreator]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum?.isMiniPay) {
      void handleConnect();
    }
  }, []);

  // Reset amount to a valid preset when switching tokens
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
      setTipStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Could not connect.",
      });
    }
  }

  async function handleTip(event: React.FormEvent) {
    event.preventDefault();

    if (lookup.kind !== "found") return;
    if (!supporterAddress) {
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
        // ERC-20 transfer — use raw eth_sendTransaction so feeCurrency works cross-wallet
        const data = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [lookup.creator.payoutAddress, amountParsed],
        });
        const txParams: Record<string, unknown> = {
          from: supporterAddress,
          to: selectedToken.address,
          data,
        };
        if (selectedToken.feeCurrency) {
          txParams.feeCurrency = selectedToken.feeCurrency;
        }
        transferTx = (await ethereum.request({
          method: "eth_sendTransaction",
          params: [txParams],
        })) as `0x${string}`;
      }

      setTipStatus({kind: "sending", step: "transfer", txHash: transferTx});
      await publicClient.waitForTransactionReceipt({hash: transferTx});

      setTipStatus({kind: "sending", step: "receipt"});
      const tokenAddress: Address =
        selectedToken.address === "native" ? ZERO_ADDRESS : selectedToken.address;

      const receiptTx = await walletClient.writeContract({
        account: supporterAddress,
        address: REGISTRY.address,
        abi: SAWER_REGISTRY_ABI,
        functionName: "recordTip",
        args: [
          lookup.creator.handle,
          tokenAddress,
          amountParsed,
          message.slice(0, 200),
          ZERO_BYTES32,
        ],
      });
      await publicClient.waitForTransactionReceipt({hash: receiptTx});

      setTipStatus({kind: "success", transferTx, receiptTx});
      setMessage("");
    } catch (err) {
      setTipStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Tip failed.",
      });
    }
  }

  if (lookup.kind === "loading") {
    return (
      <main className="shell narrow">
        <p className="status">Looking up @{normalized}…</p>
      </main>
    );
  }

  if (lookup.kind === "error") {
    return (
      <main className="shell narrow">
        <p className="error">{lookup.message}</p>
        <Link to="/">← Back home</Link>
      </main>
    );
  }

  if (lookup.kind === "not-found") {
    return (
      <main className="shell narrow">
        <Link to="/" className="back-link">
          ← Back
        </Link>
        <h1 className="page-title">Handle not found</h1>
        <p className="lede">
          No creator registered for <code>@{normalized}</code>.
        </p>
        <Link to="/create" className="btn-primary">
          Register this handle
        </Link>
      </main>
    );
  }

  const {creator} = lookup;
  const profile = decodeMetadata(creator.metadataURI);
  const displayName = profile?.name || `@${creator.handle}`;

  return (
    <main className="shell narrow">
      <Link to="/" className="back-link">
        ← Back
      </Link>

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
        <p className="eyebrow">SawerLink</p>
        <h1 className="page-title">{displayName}</h1>
        {profile?.bio && <p className="creator-bio">{profile.bio}</p>}

        {profile?.links && profile.links.length > 0 && (
          <div className="creator-links">
            {profile.links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="creator-link-btn"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}

        <p className="lede">
          <code>@{creator.handle}</code> · payout: <code>{shortAddr(creator.payoutAddress)}</code>
        </p>
        <Link to={`/s/${creator.handle}/edit`} className="edit-profile-link">
          Edit profile
        </Link>
      </header>

      <form className="creator-panel" onSubmit={handleTip}>
        {!supporterAddress ? (
          <>
            <p>Connect a wallet to tip @{creator.handle}.</p>
            {hasInjectedWallet ? (
              <button type="button" onClick={handleConnect}>
                Connect Wallet
              </button>
            ) : (
              <div className="no-wallet-fallback">
                <p className="hint">
                  No wallet detected. Paste your Celo address to preview the tip, then send from
                  your mobile wallet.
                </p>
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
                    {t.symbol}
                    {t.feeCurrency ? " (pay gas in token)" : ""}
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
              <p className="hint">{message.length}/200 characters</p>
            </label>

            <button
              type="submit"
              disabled={tipStatus.kind === "sending" || tipStatus.kind === "success"}
            >
              {tipStatus.kind === "sending"
                ? tipStatus.step === "transfer"
                  ? `Sending ${selectedToken.symbol}…`
                  : "Logging receipt…"
                : tipStatus.kind === "success"
                  ? "✓ Sent"
                  : `Send ${amount} ${selectedToken.symbol}`}
            </button>

            {tipStatus.kind === "sending" && (
              <p className="hint">
                Step {tipStatus.step === "transfer" ? "1" : "2"} of 2:{" "}
                {tipStatus.step === "transfer"
                  ? `transferring ${selectedToken.symbol}`
                  : "logging on-chain receipt"}.
              </p>
            )}

            {tipStatus.kind === "success" && (
              <div className="success-box">
                <p>
                  <strong>Tip sent!</strong>
                </p>
                <a
                  href={REGISTRY.blockExplorerTx(tipStatus.transferTx)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transfer
                </a>{" "}
                ·{" "}
                <a
                  href={REGISTRY.blockExplorerTx(tipStatus.receiptTx)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View receipt event
                </a>
              </div>
            )}

            {tipStatus.kind === "error" && <p className="error">{tipStatus.message}</p>}
          </>
        )}
      </form>

      <CrossChainQuote
        supporterAddress={supporterAddress}
        creatorAddress={creator.payoutAddress}
        creatorHandle={creator.handle}
      />

      <TipFeed creatorAddress={creator.payoutAddress} />

      <p className="hint center">
        Network: {ACTIVE_CHAIN.name} · Contract:{" "}
        <a href={REGISTRY.explorer} target="_blank" rel="noreferrer">
          {shortAddr(REGISTRY.address)}
        </a>
      </p>
    </main>
  );
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
