# SawerLink

**Cross-chain creator tipping on Celo — "Saweria for Web3"**

Creators register a handle, share a link (`/s/yourname`), and supporters on any LI.FI-supported chain tip them in CELO. Non-custodial, zero platform fee, instant settlement.

Built for [Celo Proof of Ship](https://talent.app/~/earn/celo-proof-of-ship) — May 2026.

---

## What it does

| Step | Who | Action |
|------|-----|--------|
| 1 | Creator | Connect MiniPay or MetaMask → register a handle → get `/s/yourname` |
| 2 | Creator | Optionally set display name, bio, avatar (stored on-chain via `updateMetadata`) |
| 3 | Supporter | Open link → connect wallet → choose amount → tip in CELO (2 txs: transfer + event log) |
| 4 | Supporter | Or: get a LI.FI cross-chain quote to pay from ETH / Polygon / Base / Arbitrum / Optimism |

---

## Live contracts

| Network | Address | Explorer |
|---------|---------|---------|
| Celo Sepolia (testnet) | [`0x8A8C3E9Ed4e1C00645a31d44bA4Ec8A76F6d4017`](https://celo-sepolia.blockscout.com/address/0x8a8c3e9ed4e1c00645a31d44ba4ec8a76f6d4017) | [Blockscout](https://celo-sepolia.blockscout.com) |
| Celo Mainnet | [`0x7132Ae4BF031bAe1260f32c467D1914E7DCda647`](https://explorer.celo.org/mainnet/address/0x7132Ae4BF031bAe1260f32c467D1914E7DCda647) | [Blockscout](https://explorer.celo.org/mainnet) |

### On-chain evidence (Celo Sepolia)

- Deploy tx (v2 — with updateMetadata): `0x899dc7bcb37e9a5aa53b7c2cafb0b961ced55a92b11440da336bfed00c65e725`
- First `registerCreator` (handle "sawerlink", v1 contract): `0x42b8acd7d02c5601b6e6c246ca8d419339f281c8543701dca34fc63754d3b4ad`

---

## Tech stack

| Layer | Tech |
|-------|------|
| Smart contract | Solidity 0.8.24, Foundry 1.5.1 |
| Chain | Celo mainnet + Celo Sepolia |
| Frontend | React 19, Vite 7, TypeScript |
| Web3 | viem 2.x |
| Routing | react-router-dom 7 |
| Cross-chain | LI.FI SDK 3.x |
| Wallet | MiniPay auto-detect + MetaMask + manual address fallback |

---

## Run locally

```bash
git clone <repo>
cd celo-hackathon
npm install

cp apps/web/.env.example apps/web/.env
# Edit: VITE_CHAIN=sepolia  (default dev)
#       VITE_CHAIN=mainnet  (production)

npm run dev
# → http://localhost:5173
```

MetaMask or MiniPay required. The app auto-prompts to add/switch to the correct chain.

---

## Contract

`contracts/src/SawerRegistry.sol`

```solidity
registerCreator(handle, metadataURI)              // reserve handle, payout = msg.sender
updateMetadata(handle, newMetadataURI)            // creator-only profile update
recordTip(handle, token, amount, msg, routeId)    // emits TipReceipt event
```

Metadata is stored as an inline JSON data URI:

```
data:application/json;utf8,{"name":"Display Name","bio":"Short bio","avatar":"https://..."}
```

### Deploy to Celo Sepolia

```bash
export PATH="$HOME/.foundry/bin:$PATH"
cd contracts
CELOSCAN_API_KEY=dummy forge script script/Deploy.s.sol \
  --rpc-url celo_sepolia \
  --account sawerlink-dev \
  --broadcast \
  --verify \
  --verifier blockscout \
  --verifier-url "https://celo-sepolia.blockscout.com/api/"
```

### Deploy to Celo Mainnet

```bash
CELOSCAN_API_KEY=<your_celoscan_key> forge script script/Deploy.s.sol \
  --rpc-url celo \
  --account sawerlink-dev \
  --broadcast \
  --verify \
  --verifier-url "https://api.celoscan.io/api"
```

After deploying, update `SAWER_REGISTRY_DEPLOYMENT` addresses in `apps/web/src/lib/contract.ts`.

---

## Competitive context

Inspired by [Saweria.co](https://saweria.co) — Indonesia's leading creator tip platform (5–6% fee, fiat-only, acquired by IDN Media 2023, 1M+ monthly visits).

**SawerLink positioning:** same creator-link UX, global reach via LI.FI cross-chain routing, zero platform fee, instant non-custodial CELO settlement.

---

## Proof of Ship checklist

- [x] Smart contract deployed and verified on Celo Sepolia
- [x] Frontend connects MiniPay and MetaMask
- [x] Real on-chain `registerCreator` transaction (Celo Sepolia)
- [x] Creator profile (name/bio/avatar) stored on-chain
- [x] LI.FI cross-chain quote widget
- [x] Live tip feed via `getLogs`
- [x] Mainnet deployment — `0x7132Ae4BF031bAe1260f32c467D1914E7DCda647` (tx: `0x578d7a57f4114f7964ba9f397bec390f2be71170fc4689961675efdd39bc43a2`)
- [ ] Real on-chain tip on mainnet
