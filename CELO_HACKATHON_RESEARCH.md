# Celo Proof of Ship Hackathon Research Brief

Last researched: April 22, 2026

## Program Summary

Proof of Ship is Celo's monthly builder program for teams that make visible progress month over month. For the April campaign, builders submit a Mini App, deploy on Celo Mainnet, generate onchain activity, and compete on a leaderboard. The live Talent App campaign page lists a `$5,000` prize pool, `50` winners, and campaign dates of `Apr 1-26`.

The core idea is simple: ship a usable MiniPay-compatible app on Celo, make the repo public, submit it through Talent App, and drive real transactions before the leaderboard tracking cutoff.

## April Timeline

All dates below are for the April Proof of Ship campaign.

- Submissions: April 1 through April 26 at `23:59 GMT`.
- Data tracking cutoff: April 26 at `23:59 GMT`.
- Jakarta equivalent of cutoff: April 27 at `06:59 WIB`.
- Project review: April 27 through April 30.
- Final leaderboard announcement: April 30.
- Prize pool: `5,000 USDT`, shared by the top 50 builders according to the campaign page/user brief.

## Eligibility Checklist

To be eligible, the project should satisfy every item below:

- Create a builder profile on Talent App.
- Create/register the project on Talent App.
- Submit the project on the Celo Proof of Ship campaign page.
- Build and ship a Mini App.
- Deploy a smart contract on Celo Mainnet.
- Integrate MiniPay compatibility, including the MiniPay wallet hook/detection flow.
- Keep the project open source with an active public GitHub repo.
- Generate onchain activity before the cutoff.
- Verify Proof of Humanity using one of the campaign-supported options: Self, Worldcoin, or Coinbase.

## Talent App Campaign Requirements

The live Talent App campaign page describes four required leaderboard steps:

- Build for MiniPay: add one hook and make the app compatible with MiniPay.
- Deploy on Celo: deploy a smart contract on Celo Mainnet.
- Prove Your Humanity: verify with Self, Worldcoin, or Coinbase.
- Submit Your Project: submit the project to the campaign.

Campaign page: https://talent.app/~/earn/celo-proof-of-ship

## MiniPay Context

MiniPay is a non-custodial stablecoin wallet with a Mini App discovery surface. It is integrated into Opera Mini on Android and also available as standalone Android and iOS apps.

Important product constraints:

- MiniPay is available only on Celo and Celo Sepolia Testnet.
- Supported stablecoins in current Celo docs: `USDm`, `USDC`, and `USDT`.
- MiniPay has more than `10M+` activations according to current Celo docs.
- MiniPay focuses on practical everyday use cases, especially in emerging markets.
- It maps mobile phone numbers to wallet addresses.
- It supports fast, low-cost stablecoin transactions with sub-cent fees.
- Celo docs say the app is lightweight, around `2MB`.

MiniPay docs: https://docs.celo.org/build-on-celo/build-on-minipay/overview

## Recommended MiniPay Integration

For a new app, Celo recommends starting from the Celo Composer MiniPay template:

```bash
npx @celo/celo-composer@latest create -t minipay
```

For an existing app, the minimum compatibility work should include:

- Detect the injected MiniPay provider with `window.ethereum?.isMiniPay`.
- Request the connected MiniPay address with `eth_requestAccounts`.
- Auto-connect inside MiniPay instead of showing a generic wallet connection step.
- Hide the normal "Connect Wallet" button when the app is running inside MiniPay.
- Use `viem` or `wagmi` because Celo docs recommend them for fee-currency support.
- Avoid assuming EIP-1559 transaction fields will be honored; MiniPay currently accepts legacy transactions.
- For `eth_sendTransaction`, MiniPay currently supports `feeCurrency`, but current docs say support is limited to `USDm`.

Minimal browser-side MiniPay address detection:

```ts
if (typeof window !== "undefined" && window.ethereum?.isMiniPay) {
  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
    params: [],
  });

  const address = accounts[0];
}
```

Viem wallet client pattern from Celo docs:

```ts
import { createWalletClient, custom } from "viem";
import { celo, celoSepolia } from "viem/chains";

const client = createWalletClient({
  chain: celo,
  // chain: celoSepolia, // use for testnet
  transport: custom(window.ethereum),
});

const [address] = await client.getAddresses();
```

MiniPay quickstart: https://docs.celo.org/build-on-celo/build-on-minipay/quickstart

MiniPay code library: https://docs.celo.org/build-on-celo/build-on-minipay/code-library

## Testing MiniPay Locally

MiniPay testing requires a real mobile device. Celo docs explicitly say not to test MiniPay with the Android Studio Emulator.

Recommended local testing flow:

- Install MiniPay standalone app or use Opera Mini where supported.
- Create an account with Google account and phone number.
- Open MiniPay settings.
- In the About section, tap the version number repeatedly to unlock Developer Settings.
- Return to settings and open Developer Settings.
- Enable Developer Mode.
- Toggle testnet mode when testing on Celo Sepolia.
- Run the local web app, commonly on `localhost:3000`.
- Expose it with ngrok:

```bash
ngrok http 3000
```

- In MiniPay Developer Settings, use Load Test Page and enter the ngrok URL.

## Celo Network Details

### Celo Mainnet

- Network name: Celo Mainnet
- Chain ID: `42220`
- Currency symbol: `CELO`
- Best-effort RPC endpoint: `https://forno.celo.org`
- Block explorers:
  - https://explorer.celo.org
  - https://celoscan.io
- Note: Forno is rate limited, so production or high-traffic usage may need a stronger RPC provider.

### Celo Sepolia Testnet

- Network name: Celo Sepolia
- Chain ID: `11142220`
- Currency symbol: `CELO`
- Best-effort RPC endpoint: `https://forno.celo-sepolia.celo-testnet.org`
- OP-node RPC endpoint: `https://op.celo-sepolia.celo-testnet.org`
- Block explorer: https://celo-sepolia.blockscout.com
- Bridge: https://testnets.superbridge.app
- Faucets:
  - https://cloud.google.com/application/web3/faucet/celo/sepolia
  - https://faucet.celo.org/celo-sepolia

Celo network docs: https://docs.celo.org/build-on-celo/network-overview

## Stablecoin And Fee Notes

Useful stablecoin contract detail from Celo docs:

- `USDm` on Celo Mainnet: `0x765DE816845861e75A25fCA122bb6898B8B1282a`

Use cases we can build around:

- Stablecoin payments.
- Merchant checkout.
- Remittances or splitting bills.
- Community savings.
- Micro-donations.
- Proof-of-participation payments.
- Rewards or loyalty credits.

Implementation notes:

- Use `viem@2` or newer.
- Celo MiniPay docs recommend TypeScript v5 or newer.
- Install Celo helper packages if needed:

```bash
npm install @celo/abis @celo/identity viem
```

## Proof Of Humanity

The campaign accepts Proof of Humanity verification through Self, Worldcoin, or Coinbase. For a Celo-native identity angle, Self is the most aligned with the docs.

Self summary:

- Privacy-first, open-source identity protocol.
- Uses zero-knowledge proofs.
- Lets users prove humanity without revealing sensitive personal information.
- Supports real-world attestations including passports, EU biometric ID cards, and Indian Aadhaar.
- The proof flow is: scan identity document, generate a zk proof, share the proof with the selected app.
- Useful for sybil resistance, airdrop protection, marketplaces, quadratic funding, polling, age checks, and trust profiles.

Self on Celo docs: https://docs.celo.org/build-on-celo/build-with-self

Self docs: https://docs.self.xyz

## Onchain Activity Strategy

The leaderboard is based on onchain transactions, so the app should make useful transactions easy and repeatable without becoming spammy.

Recommended transaction surfaces:

- User onboarding transaction: register profile, create group, create savings goal, or initialize user state.
- Core action transaction: pay, pledge, donate, tip, split, claim, vote, stake, or mark task complete.
- Social loop transaction: invite, reward, contribution, referral, or group settlement.
- Admin/project transaction: deploy contract, seed initial campaign, update metadata, or finalize an event.

Avoid designing fake transaction loops. The stronger approach is to create a small app where transactions are naturally part of the user workflow.

## Strong Project Directions For This Campaign

MiniPay's audience and constraints favor simple mobile-first stablecoin utilities. Good candidates:

- Group savings circles: users create savings groups, contribute USDm/USDC/USDT, and track contributions onchain.
- Merchant payment links: MiniPay users pay small merchants through stablecoin checkout links with receipts.
- Community micro-grants: users donate stablecoins to local causes, with public proof of distribution.
- Bill splitting: one user creates a bill, friends pay their share from MiniPay, and settlement is tracked onchain.
- Proof-of-attendance rewards: event organizers create events and distribute small stablecoin rewards to verified attendees.
- Remittance tracker: simple sender/recipient flow optimized for phone-number wallet behavior.
- Creator tipping jar: mobile-first MiniPay tipping with public creator pages and onchain contribution history.

For fastest Proof of Ship execution, a good MVP is: MiniPay wallet detection, one simple smart contract, one stablecoin transaction path, one public project page, and a clear loop that can generate legitimate user transactions.

## Suggested MVP Architecture

Frontend:

- Next.js or Vite React.
- Mobile-first UI.
- `wagmi` or `viem` for wallet and chain calls.
- Detect MiniPay and auto-connect.
- Hide generic wallet connection inside MiniPay.

Smart contract:

- Small Solidity contract deployed on Celo Mainnet.
- Keep state minimal: projects, groups, contributions, payments, claims, or receipts.
- Emit events for every important user action so activity is visible on explorers and easy to index.

Backend:

- Avoid backend unless needed.
- If needed, use a small API for metadata, offchain indexing, or project admin.
- Do not put private keys in the frontend.

Deployment:

- Frontend on Vercel, Netlify, Cloudflare Pages, or similar.
- Contract on Celo Mainnet before submission.
- Public GitHub repo with clear README, screenshots, deployment links, and contract addresses.

## Submission Readiness Checklist

Before submitting:

- Public GitHub repo exists and has recent commits.
- README includes project description, MiniPay/Celo usage, contract address, deployed app URL, and setup instructions.
- App is deployed and reachable from mobile.
- Smart contract is deployed to Celo Mainnet.
- Contract address is verified or at least visible on a Celo explorer.
- MiniPay detection works on a physical phone.
- Normal browser fallback works enough for judges to inspect.
- Proof of Humanity is completed by the builder on Talent App.
- Project is submitted on the Proof of Ship Talent App page.
- At least a few real onchain interactions have been completed before April 26 at `23:59 GMT`.

## Source Links

- Talent App Proof of Ship campaign: https://talent.app/~/earn/celo-proof-of-ship
- Celo Proof of Ship program page: https://www.celopg.eco/programs/proof-of-ship
- MiniPay overview: https://docs.celo.org/build-on-celo/build-on-minipay/overview
- MiniPay quickstart: https://docs.celo.org/build-on-celo/build-on-minipay/quickstart
- MiniPay code library: https://docs.celo.org/build-on-celo/build-on-minipay/code-library
- MiniPay deeplinks: https://docs.celo.org/build/build-on-minipay/deeplinks
- Celo network information: https://docs.celo.org/build-on-celo/network-overview
- Celo faucet: https://faucet.celo.org/celo-sepolia
- Mento app for testnet stablecoin swaps: https://app.mento.org
- Build with Self on Celo: https://docs.celo.org/build-on-celo/build-with-self
- Self docs: https://docs.self.xyz
