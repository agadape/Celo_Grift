import {useCallback, useEffect, useRef, useState} from "react";
import {useParams, useSearchParams} from "react-router-dom";
import {formatUnits} from "viem";
import type {Address} from "viem";
import {publicClient} from "../lib/publicClient";
import {SAWER_REGISTRY_ABI, getActiveRegistry, handleHash} from "../lib/contract";
import {CELO_TOKENS} from "../lib/tokens";
import {parseMedia, getYoutubeId, getMediaKind} from "../lib/media";

const REGISTRY = getActiveRegistry();
const POLL_MS = 5_000;
const ENTRANCE_MS = 500;
const EXIT_MS = 600;

// Known reaction emojis (same set as TipPage)
const REACTIONS = ["🔥", "❤️", "💎", "🚀", "👑", "⚡", "🎉", "💯"];

interface TipAlert {
  id: string;
  amount: bigint;
  token: Address;
  message: string;
}

// Position map: URL param → CSS values
const POSITIONS: Record<string, React.CSSProperties> = {
  "bottom-center": {bottom: 72, left: "50%", transform: "translateX(-50%)"},
  "bottom-left":   {bottom: 72, left: 24},
  "bottom-right":  {bottom: 72, right: 24},
  "top-left":      {top: 24,    left: 24},
  "top-right":     {top: 24,    right: 24},
};
const ENTER_ANIM: Record<string, string> = {
  "bottom-center": "ov-enter-up",
  "bottom-left":   "ov-enter-left",
  "bottom-right":  "ov-enter-right",
  "top-left":      "ov-enter-left",
  "top-right":     "ov-enter-right",
};

let _ctx: AudioContext | null = null;
let _customAudio: HTMLAudioElement | null = null;

function unlockAudio() {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === "suspended") void _ctx.resume();
  _customAudio = new Audio("/tip_alert.wav");
  _customAudio.load();
}

function playAlert() {
  if (_customAudio && _customAudio.readyState >= 2) {
    _customAudio.currentTime = 0;
    void _customAudio.play().catch(() => fallbackChime());
    return;
  }
  fallbackChime();
}

function fallbackChime() {
  if (!_ctx) return;
  const ctx = _ctx;
  [523.25, 659.25, 783.99, 987.77].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = ctx.currentTime + i * 0.14;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.start(t);
    osc.stop(t + 0.65);
  });
}

function getTokenInfo(addr: Address): {symbol: string; decimals: number} {
  const ZERO = "0x0000000000000000000000000000000000000000";
  if (addr.toLowerCase() === ZERO) return {symbol: "CELO", decimals: 18};
  const t = CELO_TOKENS.find((x) => x.address !== "native" && x.address.toLowerCase() === addr.toLowerCase());
  return t ? {symbol: t.symbol, decimals: t.decimals} : {symbol: "tokens", decimals: 18};
}

function formatAmount(amount: bigint, token: Address): string {
  const {symbol, decimals} = getTokenInfo(token);
  const val = parseFloat(formatUnits(amount, decimals));
  const str = val < 0.001 ? val.toFixed(6) : val < 1 ? val.toFixed(4) : val.toFixed(2);
  return `${str} ${symbol}`;
}

function parseReaction(msg: string): {emoji: string; text: string} {
  for (const r of REACTIONS) {
    if (msg.startsWith(r)) return {emoji: r, text: msg.slice(r.length).trimStart()};
  }
  return {emoji: "", text: msg};
}

const TEST_ALERT: TipAlert = {
  id: "test",
  amount: 5_000_000_000_000_000_000n,
  token: "0x0000000000000000000000000000000000000000" as Address,
  message: "🔥 Great stream, keep it up!",
};

export function OverlayPage() {
  const {handle = ""} = useParams();
  const [searchParams] = useSearchParams();
  const isTest = searchParams.get("test") === "1";
  const normalized = handle.toLowerCase();

  // Customization from URL params
  const pos = searchParams.get("pos") ?? "bottom-center";
  const accentRaw = searchParams.get("accent") ?? "35d07f";
  const accent = accentRaw.startsWith("#") ? accentRaw : `#${accentRaw}`;
  const displayMs = Math.max(3, Math.min(15, Number(searchParams.get("dur") ?? 7))) * 1000;

  const posStyle = POSITIONS[pos] ?? POSITIONS["bottom-center"];
  const enterClass = ENTER_ANIM[pos] ?? "ov-enter-up";

  const [creatorAddress, setCreatorAddress] = useState<Address | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [queue, setQueue] = useState<TipAlert[]>([]);
  const [current, setCurrent] = useState<TipAlert | null>(null);
  const [progress, setProgress] = useState(100);
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  const lastBlockRef = useRef<bigint>(0n);
  const busyRef = useRef(false);

  useEffect(() => {
    document.body.style.background = "transparent";
    return () => { document.body.style.background = ""; };
  }, []);

  useEffect(() => {
    if (isTest) {setQueue([TEST_ALERT]); return;}
    async function load() {
      try {
        const result = await publicClient.readContract({
          address: REGISTRY.address,
          abi: SAWER_REGISTRY_ABI,
          functionName: "creatorsByHandle",
          args: [handleHash(normalized)],
        });
        if (result[3]) {
          setCreatorAddress(result[0]);
          lastBlockRef.current = await publicClient.getBlockNumber();
        }
      } catch { /* unknown handle */ }
    }
    void load();
  }, [normalized, isTest]);

  const poll = useCallback(async () => {
    if (!creatorAddress) return;
    try {
      const latest = await publicClient.getBlockNumber();
      if (latest <= lastBlockRef.current) return;
      const fromBlock = lastBlockRef.current + 1n;
      lastBlockRef.current = latest;
      const logs = await publicClient.getLogs({
        address: REGISTRY.address,
        event: SAWER_REGISTRY_ABI.find((x) => x.type === "event" && x.name === "TipReceipt") as (typeof SAWER_REGISTRY_ABI)[number] & {type: "event"},
        args: {creator: creatorAddress},
        fromBlock,
        toBlock: latest,
      });
      if (!logs.length) return;
      setQueue((q) => [
        ...q,
        ...logs.map((log) => ({
          id: `${log.transactionHash ?? ""}-${String(log.logIndex ?? Math.random())}`,
          amount: (log.args as {amount?: bigint}).amount ?? 0n,
          token: (log.args as {token?: Address}).token ?? ("0x0000000000000000000000000000000000000000" as Address),
          message: (log.args as {message?: string}).message ?? "",
        })),
      ]);
    } catch { /* retry */ }
  }, [creatorAddress]);

  useEffect(() => {
    if (!creatorAddress) return;
    const id = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(id);
  }, [creatorAddress, poll]);

  // Phase machine
  useEffect(() => {
    if (phase === "in") {
      const t = setTimeout(() => setPhase("hold"), ENTRANCE_MS);
      return () => clearTimeout(t);
    }
    if (phase === "hold") {
      const t = setTimeout(() => setPhase("out"), displayMs);
      return () => clearTimeout(t);
    }
    if (phase === "out") {
      const t = setTimeout(() => { setCurrent(null); busyRef.current = false; }, EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [phase, displayMs]);

  // Progress bar
  useEffect(() => {
    if (phase !== "hold") return;
    setProgress(100);
    const start = Date.now();
    const id = setInterval(() => {
      const pct = Math.max(0, 100 - ((Date.now() - start) / displayMs) * 100);
      setProgress(pct);
      if (pct <= 0) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [phase, displayMs]);

  // Dequeue
  useEffect(() => {
    if (busyRef.current || current !== null || queue.length === 0) return;
    busyRef.current = true;
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next);
    setProgress(100);
    setPhase("in");
    if (soundEnabled) playAlert();
  }, [queue, current, soundEnabled]);

  const parsed = current ? parseMedia(current.message) : null;
  const reaction = parsed ? parseReaction(parsed.text) : null;
  const mediaUrl = parsed?.mediaUrl ?? "";
  const mediaKind = getMediaKind(mediaUrl);
  const youtubeId = mediaKind === "youtube" ? getYoutubeId(mediaUrl) : null;
  const hasMedia = !!(mediaKind && (youtubeId || mediaKind === "image"));

  return (
    <div className="ov-root">
      {!soundEnabled && (
        <button className="ov-sound-btn" onClick={() => { unlockAudio(); setSoundEnabled(true); }}>
          🔔 Enable sound
        </button>
      )}

      {current && (
        <div
          className={`ov-alert ov-alert--${phase} ov-alert--${enterClass}${hasMedia ? " ov-alert--media" : ""}`}
          style={{
            ...posStyle,
            borderColor: accent,
            boxShadow: `0 0 0 1px ${accent}22, 0 0 48px ${accent}38, 0 20px 48px rgba(0,0,0,0.7)`,
          }}
        >
          {/* Media panel — YouTube iframe or image/GIF */}
          {hasMedia && (
            <div className="ov-media">
              {youtubeId ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&controls=0&rel=0&modestbranding=1`}
                  allow="autoplay; encrypted-media"
                  allowFullScreen={false}
                  title="tip media"
                />
              ) : (
                <img src={mediaUrl} alt="" />
              )}
            </div>
          )}

          <div className="ov-icon-col">
            {reaction?.emoji ? (
              <span className="ov-reaction-emoji">{reaction.emoji}</span>
            ) : (
              <CeloMark accent={accent} />
            )}
          </div>
          <div className="ov-content">
            <span className="ov-eyebrow" style={{color: accent}}>New tip!</span>
            <p className="ov-amount">{formatAmount(current.amount, current.token)}</p>
            {reaction?.text && <p className="ov-message">"{reaction.text}"</p>}
          </div>
          <div className="ov-progress-track">
            <div className="ov-progress-fill" style={{width: `${progress}%`, background: `linear-gradient(90deg, ${accent}, ${accent}cc)`}} />
          </div>
        </div>
      )}
    </div>
  );
}

function CeloMark({accent}: {accent: string}) {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="26" cy="26" r="26" fill={accent} />
      <circle cx="26" cy="26" r="14" stroke="#ffffff" strokeWidth="4" fill="none" />
      <circle cx="26" cy="13" r="5" fill="#ffffff" />
      <circle cx="36.6" cy="33" r="5" fill="#ffffff" />
    </svg>
  );
}
