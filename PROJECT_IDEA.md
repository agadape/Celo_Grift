# Project Idea: Cross-Chain Saweria For MiniPay

Last updated: April 22, 2026

## Raw Idea

Build a Saweria-style donation/payment link that creators can put in their bio, DM, or social profile. Supporters can send from many chains, then LI.FI routes the payment into a Celo stablecoin for the creator.

## One-Liner

A MiniPay-friendly creator tipping link where fans can pay from any supported chain, while creators receive stablecoins on Celo.

## Working Name Options

- SawerX
- SawerLink
- TipJalan
- CeloSawer
- AnyChain Sawer

## Why It Fits Celo Proof Of Ship

- MiniPay fit: creators and supporters can use simple mobile-first stablecoin payments.
- Celo mainnet fit: each creator page, tip, or receipt can create real onchain activity.
- LI.FI fit: the core feature depends on cross-chain routing instead of manually integrating many bridges.
- Public-good angle: small creators, community organizers, streamers, educators, and open-source builders can receive funds with less chain friction.

## MVP Scope

The first version should focus on the Saweria flow only:

- Creator connects MiniPay or Celo wallet.
- Creator creates a public tipping page/link.
- Supporter opens the link.
- Supporter chooses token/source chain.
- App uses LI.FI to quote and route payment into a Celo stablecoin.
- Creator receives stablecoin on Celo.
- App writes a simple onchain receipt/event on Celo.
- Creator page shows recent tips and total received.

Avoid making the first version too broad. Auto-staking, lending, and more advanced DeFi routing can be a second feature after the basic tipping flow works.

## Core User Flow

1. Creator opens the app in MiniPay.
2. App detects `window.ethereum.isMiniPay` and auto-connects.
3. Creator enters display name, handle, short bio, and Celo receiving address.
4. App creates a creator profile onchain or stores metadata offchain with an onchain profile ID.
5. Creator copies a public link, for example `/s/username`.
6. Supporter opens the link from any browser.
7. Supporter selects source chain and source token.
8. LI.FI provides routes to the target Celo stablecoin.
9. Supporter confirms the route with their wallet.
10. App tracks the transaction status.
11. Once funds arrive, the app records or displays the tip as a creator receipt.

## LI.FI Integration Plan

Use LI.FI as the main routing layer:

- Use the LI.FI SDK or REST API for quotes/routes.
- Source side: supported chains/tokens from LI.FI.
- Destination side: Celo stablecoin, preferably `USDC`, `USDT`, or `USDm` depending on route support and MiniPay compatibility.
- Use route status tracking so the supporter sees pending, completed, or failed states.
- Configure allowed destination chain as Celo Mainnet.
- Consider allowlisting safer route tools if needed.

Relevant LI.FI docs:

- Docs home: https://docs.li.fi
- SDK overview: https://docs.li.fi/sdk/overview
- API chains endpoint: https://docs.li.fi/api-reference/get-information-about-all-currently-supported-chains
- LI.FI product page: https://li.fi/sdk/

## Celo Contract Idea

Keep the first smart contract simple:

```solidity
contract SawerRegistry {
    event CreatorRegistered(
        address indexed creator,
        string handle,
        string metadataURI
    );

    event TipReceived(
        address indexed creator,
        address indexed token,
        uint256 amount,
        string message,
        bytes32 indexed externalRouteId
    );
}
```

Possible responsibilities:

- Register creator handles.
- Store creator receiving wallet.
- Emit creator registration events.
- Emit tip receipt events after a completed LI.FI route.

Important decision: if LI.FI sends funds directly to the creator wallet, the app may need a follow-up Celo transaction to record the message/receipt. If we want the tip and receipt in one destination action, we should investigate LI.FI destination contract calls or route-to-contract patterns.

## Advanced Feature: Idle Money

The user idea included "uang masuk gak diam": when funds arrive, automatically put some funds into DeFi, staking, or lending.

Good later-stage versions:

- Creator can enable auto-split: `80%` liquid wallet, `20%` deposit to yield.
- Creator can manually sweep balance into a selected Celo DeFi vault.
- App recommends low-risk stablecoin options only after the basic tipping flow is stable.
- Use LI.FI Composer if the selected strategy is supported by LI.FI.

Do not make automatic DeFi deposit mandatory for MVP. It adds security, UX, and risk-disclosure complexity. For hackathon scoring, the tipping link plus cross-chain conversion is already a strong core.

## Product Positioning

Indonesian pitch:

> Saweria versi Web3: kreator cukup share satu link, supporter bisa sawer dari chain mana pun, dan kreator terima stablecoin di Celo/MiniPay.

English pitch:

> A cross-chain creator tipping link: pay from any supported chain, receive stablecoins on Celo through MiniPay.

## Main Risks

- LI.FI route availability to the exact Celo stablecoin we choose must be verified.
- Cross-chain flows can take time, so status tracking needs to be clear.
- MiniPay testing requires a physical mobile device.
- If we use direct-to-creator transfers, recording a tip message onchain may require a second transaction.
- Auto-yield features can create security and compliance concerns if rushed.

## Build Priority

1. MiniPay-compatible creator onboarding.
2. Public creator tipping page.
3. LI.FI quote and route execution into Celo.
4. Celo onchain receipt/registry.
5. Recent tips and totals.
6. Deployed app, public GitHub repo, Celo mainnet contract.
7. Optional: creator-controlled auto-split or manual DeFi deposit.

## Hackathon Fit Checklist

- Deploy on Celo Mainnet: yes, registry/receipt contract.
- MiniPay hook: yes, creator onboarding should auto-detect MiniPay.
- Open source GitHub: required.
- Onchain activity: creator registration and tip receipt events.
- Proof of Humanity: builder must verify on Talent App.
- Leaderboard value: each real tip can create meaningful onchain activity.
