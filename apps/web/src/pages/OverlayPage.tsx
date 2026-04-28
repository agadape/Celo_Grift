import {useCallback, useEffect, useRef, useState} from "react";
import {useParams, useSearchParams} from "react-router-dom";
import {formatUnits} from "viem";
import type {Address} from "viem";
import {publicClient} from "../lib/publicClient";
import {SAWER_REGISTRY_ABI, getActiveRegistry, handleHash} from "../lib/contract";
import {CELO_TOKENS} from "../lib/tokens";

const REGISTRY = getActiveRegistry();
const POLL_MS = 5_000;
const DISPLAY_MS = 7_000;
const ENTRANCE_MS = 500;
const EXIT_MS = 600;

interface TipAlert {
  id: string;
  amount: bigint;
  token: Address;
  message: string;
}

// Audio — created lazily after user gesture
let _ctx: AudioContext | null = null;
let _customAudio: HTMLAudioElement | null = null;

function unlockAudio() {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === "suspended") void _ctx.resume();

  // Try loading custom sound if dropped in /public
  _customAudio = new Audio("/tip_alert.wav");
  _customAudio.load();
}

function playAlert() {
  // Prefer custom sound file if it loaded cleanly
  if (_customAudio && _customAudio.readyState >= 2) {
    _customAudio.currentTime = 0;
    void _customAudio.play().catch(() => fallbackChime());
    return;
  }
  fallbackChime();
}

// Web Audio API ascending arpeggio: C5 E5 G5 B5
function fallbackChime() {
  if (!_ctx) return;
  const ctx = _ctx;
  const notes = [523.25, 659.25, 783.99, 987.77];
  notes.forEach((freq, i) => {
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
  const t = CELO_TOKENS.find(
    (x) => x.address !== "native" && x.address.toLowerCase() === addr.toLowerCase(),
  );
  return t ? {symbol: t.symbol, decimals: t.decimals} : {symbol: "tokens", decimals: 18};
}

function formatAmount(amount: bigint, token: Address): string {
  const {symbol, decimals} = getTokenInfo(token);
  const val = parseFloat(formatUnits(amount, decimals));
  const str = val < 0.001 ? val.toFixed(6) : val < 1 ? val.toFixed(4) : val.toFixed(2);
  return `${str} ${symbol}`;
}

const TEST_ALERT: TipAlert = {
  id: "test",
  amount: 5_000_000_000_000_000_000n, // 5 CELO
  token: "0x0000000000000000000000000000000000000000" as Address,
  message: "Great stream, keep it up! 🔥",
};

export function OverlayPage() {
  const {handle = ""} = useParams();
  const [searchParams] = useSearchParams();
  const isTest = searchParams.get("test") === "1";
  const normalized = handle.toLowerCase();

  const [creatorAddress, setCreatorAddress] = useState<Address | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [queue, setQueue] = useState<TipAlert[]>([]);
  const [current, setCurrent] = useState<TipAlert | null>(null);
  const [progress, setProgress] = useState(100);
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  const lastBlockRef = useRef<bigint>(0n);
  const busyRef = useRef(false);

  // Transparent body for OBS compositing
  useEffect(() => {
    document.body.style.background = "transparent";
    return () => {
      document.body.style.background = "";
    };
  }, []);

  // Load creator; if ?test=1 skip and enqueue a fake alert instead
  useEffect(() => {
    if (isTest) {
      setQueue([TEST_ALERT]);
      return;
    }
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
      } catch {
        // unknown handle — overlay idles silently
      }
    }
    void load();
  }, [normalized, isTest]);

  // Poll for new TipReceipt events
  const poll = useCallback(async () => {
    if (!creatorAddress) return;
    try {
      const latest = await publicClient.getBlockNumber();
      if (latest <= lastBlockRef.current) return;
      const fromBlock = lastBlockRef.current + 1n;
      lastBlockRef.current = latest;

      const logs = await publicClient.getLogs({
        address: REGISTRY.address,
        event: SAWER_REGISTRY_ABI.find(
          (x) => x.type === "event" && x.name === "TipReceipt",
        ) as (typeof SAWER_REGISTRY_ABI)[number] & {type: "event"},
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
          token:
            (log.args as {token?: Address}).token ??
            ("0x0000000000000000000000000000000000000000" as Address),
          message: (log.args as {message?: string}).message ?? "",
        })),
      ]);
    } catch {
      // network blip — retry next interval
    }
  }, [creatorAddress]);

  useEffect(() => {
    if (!creatorAddress) return;
    const id = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(id);
  }, [creatorAddress, poll]);

  // Phase-transition state machine
  useEffect(() => {
    if (phase === "in") {
      const t = setTimeout(() => setPhase("hold"), ENTRANCE_MS);
      return () => clearTimeout(t);
    }
    if (phase === "hold") {
      const t = setTimeout(() => setPhase("out"), DISPLAY_MS);
      return () => clearTimeout(t);
    }
    if (phase === "out") {
      const t = setTimeout(() => {
        setCurrent(null);
        busyRef.current = false;
      }, EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Progress bar depletion during hold
  useEffect(() => {
    if (phase !== "hold") return;
    setProgress(100);
    const start = Date.now();
    const id = setInterval(() => {
      const pct = Math.max(0, 100 - ((Date.now() - start) / DISPLAY_MS) * 100);
      setProgress(pct);
      if (pct <= 0) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [phase]);

  // Dequeue next alert when idle
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

  return (
    <div className="ov-root">
      {/* Sound unlock — click once during OBS setup */}
      {!soundEnabled && (
        <button
          className="ov-sound-btn"
          onClick={() => {
            unlockAudio();
            setSoundEnabled(true);
          }}
        >
          🔔 Enable sound
        </button>
      )}

      {current && (
        <div className={`ov-alert ov-alert--${phase}`}>
          {/* Left icon column */}
          <div className="ov-icon-col">
            <CeloMark />
          </div>

          {/* Right content column */}
          <div className="ov-content">
            <span className="ov-eyebrow">New tip!</span>
            <p className="ov-amount">{formatAmount(current.amount, current.token)}</p>
            {current.message && (
              <p className="ov-message">"{current.message}"</p>
            )}
          </div>

          {/* Bottom progress bar */}
          <div className="ov-progress-track">
            <div className="ov-progress-fill" style={{width: `${progress}%`}} />
          </div>
        </div>
      )}
    </div>
  );
}

// Inline SVG — CELO brand mark (three-circle pattern)
function CeloMark() {
  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* outer green disc */}
      <circle cx="26" cy="26" r="26" fill="#35d07f" />
      {/* centre ring */}
      <circle cx="26" cy="26" r="14" stroke="#ffffff" strokeWidth="4" fill="none" />
      {/* top dot */}
      <circle cx="26" cy="13" r="5" fill="#ffffff" />
      {/* bottom-right dot */}
      <circle cx="36.6" cy="33" r="5" fill="#ffffff" />
    </svg>
  );
}
