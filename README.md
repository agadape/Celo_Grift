# SawerLink

**Cross-chain creator tipping on Celo — "Saweria for Web3"**

Creators register a handle, share a link (`/s/yourname`), and supporters on any LI.FI-supported chain tip them in CELO or stablecoins. Non-custodial, zero platform fee, instant settlement.

**Live:** https://celo-grift-web.vercel.app

Built for [Celo Proof of Ship](https://talent.app/~/earn/celo-proof-of-ship) — May 2026.

---

## What it does

| Step | Who | Action |
|------|-----|--------|
| 1 | Creator | Connect MiniPay or MetaMask → register a handle → get `/s/yourname` |
| 2 | Creator | Set display name, bio, avatar, social links, tip goal (stored on-chain) |
| 3 | Supporter | Open link → connect wallet → pick emoji reaction → tip in CELO / cUSD / USDC / USDT |
| 4 | Supporter | Or: get a LI.FI cross-chain quote to pay from ETH / Polygon / Base / Arbitrum / Optimism |
| 5 | Creator | Add OBS Browser Source URL → live tip alerts appear mid-stream |

---

## Features

### Creator tools
- **Handle registration** — on-chain, `keccak256`-keyed mapping, first come first served
- **Profile editor** — display name, bio, avatar URL, up to 8 Linktree-style links
- **Tip goal** — set a fundraising target (token + amount); live progress bar on tip page
- **Dashboard** — tip link + copy, embed iframe snippet, OBS overlay URL builder
- **Edit profile** — creator-only `updateMetadata` call, on-chain ownership enforced

### Supporter experience
- **Stablecoin tips** — CELO, cUSD (feeCurrency), USDC, USDT
- **Emoji reactions** — 8 preset emojis prepended to tip message, shown in overlay
- **QR code** — scan-to-tip image on every creator page
- **Top tips leaderboard** — top 5 per creator page + `/leaderboard` global page
- **Cross-chain** — LI.FI bridge from ETH/Polygon/Base/Arbitrum/Optimism → CELO on-chain receipt

### Stream overlay
- **OBS Browser Source** — `/overlay/:handle` polls for `TipReceipt` events every 5s
- **Customizable** — `?pos=` (5 positions) · `?accent=` (hex color) · `?dur=` (3–15s)
- **Audio alerts** — Web Audio API chime + optional custom `tip_alert.wav`
- **Emoji display** — reaction emoji shown large instead of Celo mark
- **Position-aware animations** — slide-up / slide-left / slide-right with matching exit

### Discovery
- **Explore page** — grid of all registered creators, deduped by address
- **Global leaderboard** — top 10 by total CELO received + top 10 biggest single tips
- **Live homepage stats** — real-time creator count + tip count from on-chain events
- **Sticky navbar** — Explore · Leaderboard · Dashboard on every page

---

## Live contracts

| Network | Address | Explorer |
|---------|---------|---------|
| **Celo Mainnet** | [`0x7132Ae4BF031bAe1260f32c467D1914E7DCda647`](https://explorer.celo.org/mainnet/address/0x7132Ae4BF031bAe1260f32c467D1914E7DCda647) | [Blockscout](https://explorer.celo.org/mainnet) |
| Celo Sepolia (testnet) | [`0x8A8C3E9Ed4e1C00645a31d44bA4Ec8A76F6d4017`](https://celo-sepolia.blockscout.com/address/0x8a8c3e9ed4e1c00645a31d44ba4ec8a76f6d4017) | [Blockscout](https://celo-sepolia.blockscout.com) |

### On-chain evidence

| Event | Network | Tx hash |
|-------|---------|---------|
| Contract deploy (mainnet) | Celo Mainnet | `0x578d7a57f4114f7964ba9f397bec390f2be71170fc4689961675efdd39bc43a2` |
| Contract deploy (testnet v2) | Celo Sepolia | `0x899dc7bcb37e9a5aa53b7c2cafb0b961ced55a92b11440da336bfed00c65e725` |
| First `registerCreator` | Celo Sepolia | `0x42b8acd7d02c5601b6e6c246ca8d419339f281c8543701dca34fc63754d3b4ad` |

---

## Tech stack

| Layer | Tech |
|-------|------|
| Smart contract | Solidity 0.8.24, Foundry |
| Chain | Celo Mainnet + Celo Sepolia |
| Frontend | React 19, Vite 7, TypeScript |
| Web3 | viem 2.x |
| Routing | react-router-dom 7 |
| Cross-chain | LI.FI SDK 3.x |
| Wallet | MiniPay auto-detect · MetaMask · manual address fallback |
| Deploy | Vercel (SPA rewrite, `VITE_CHAIN=mainnet` build env) |

---

## Run locally

```bash
git clone https://github.com/agadape/Celo_Grift.git
cd Celo_Grift
npm install

cp apps/web/.env.example apps/web/.env
# VITE_CHAIN=sepolia   ← local dev (default)
# VITE_CHAIN=mainnet   ← production

npm run dev        # → http://localhost:5173
npm run typecheck  # type safety check
```

MetaMask or MiniPay required. The app auto-prompts to add/switch chain.

---

## Contract

`contracts/src/SawerRegistry.sol`

```solidity
registerCreator(handle, metadataURI)           // reserve handle, payout = msg.sender
updateMetadata(handle, newMetadataURI)         // creator-only profile update
recordTip(handle, token, amount, msg, routeId) // emits TipReceipt event
```

Metadata is stored as an inline JSON data URI on-chain:

```json
{
  "name": "Display Name",
  "bio": "Short bio",
  "avatar": "https://example.com/avatar.png",
  "links": [{"label": "YouTube", "url": "https://youtube.com/@handle"}],
  "goal": {"label": "New mic", "target": "100", "token": "cUSD"}
}
```

### Deploy

```bash
# Testnet
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url celo_sepolia \
  --account sawerlink-dev \
  --broadcast --verify \
  --verifier blockscout \
  --verifier-url "https://celo-sepolia.blockscout.com/api/"

# Mainnet
CELOSCAN_API_KEY=<key> forge script script/Deploy.s.sol \
  --rpc-url celo \
  --account sawerlink-dev \
  --broadcast --verify \
  --verifier-url "https://api.celoscan.io/api"
```

---

## Competitive context

Inspired by [Saweria.co](https://saweria.co) — Indonesia's leading creator tip platform (5–6% fee, fiat-only, 1M+ monthly visits).

**SawerLink positioning:**

| | Saweria | SawerLink |
|--|---------|-----------|
| Fee | 5–6% | ~sub-cent gas only |
| Custody | Platform holds funds | Non-custodial, direct wallet |
| Reach | IDR (Indonesian Rupiah) | Any LI.FI-supported chain |
| Settlement | Bank transfer (T+1) | Instant on Celo |
| Stream overlay | ✅ | ✅ |
| Stablecoins | ❌ | cUSD / USDC / USDT |

---

## Proof of Ship checklist

- [x] Smart contract deployed and verified on Celo Sepolia
- [x] Smart contract deployed on Celo Mainnet (`0x7132Ae4BF031bAe1260f32c467D1914E7DCda647`)
- [x] Frontend live at https://celo-grift-web.vercel.app
- [x] MiniPay auto-connect + MetaMask + manual address fallback
- [x] Real on-chain `registerCreator` transaction (Celo Sepolia)
- [x] Creator profile: name, bio, avatar, social links stored on-chain
- [x] Creator-editable profile via `updateMetadata` (ownership enforced)
- [x] Tip in CELO (native), cUSD, USDC, USDT with feeCurrency support
- [x] LI.FI cross-chain quote + bridge from ETH/Polygon/Base/Arbitrum/Optimism
- [x] Live tip feed via `getLogs` (real-time event indexing)
- [x] Tip goal with on-chain progress bar
- [x] Emoji reactions (8 presets, prepended to message)
- [x] QR code scan-to-tip
- [x] Top tips leaderboard (per-creator + global `/leaderboard` page)
- [x] Creator discovery `/explore` page
- [x] OBS stream overlay with live tip alerts, audio, and exit animations
- [x] Overlay customization: position, accent color, alert duration
- [x] Embed iframe widget for websites/blogs
- [x] Homepage live stats (creator count + tip count from chain)
- [x] Sticky navbar, responsive mobile layout
- [x] OG/Twitter meta tags for social sharing
