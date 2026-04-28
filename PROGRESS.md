# Progress Log

## April 22, 2026

### Project Initialized

- Created project directory: `D:\celo-hackathon`.
- Initialized Git repository.
- Kept research and product notes at the repo root:
  - `CELO_HACKATHON_RESEARCH.md`
  - `PROJECT_IDEA.md`

### App Scaffold

- Created npm workspace project.
- Added Vite + React + TypeScript web app in `apps/web`.
- Added root scripts:
  - `npm run dev`
  - `npm run build`
  - `npm run preview`
  - `npm run lint`
  - `npm run typecheck`

### Web3 Dependencies

- Installed:
  - `@lifi/sdk`
  - `viem`
  - `react`
  - `react-dom`
  - `vite`
  - `typescript`
  - ESLint tooling

### MiniPay Work

- Added MiniPay detection and connection helper:
  - `apps/web/src/lib/minipay.ts`
- Current behavior:
  - Checks for injected `window.ethereum`.
  - Requires `window.ethereum.isMiniPay`.
  - Requests accounts with `eth_requestAccounts`.
  - Returns the connected creator address.

### LI.FI Work

- Added initial LI.FI SDK config stub:
  - `apps/web/src/lib/lifi.ts`
- Current behavior:
  - Sets the LI.FI integrator name to `sawerlink-celo-proof-of-ship`.
- Next LI.FI work:
  - Fetch supported chains/tokens.
  - Build quote UI.
  - Route supporter payments to Celo stablecoin.
  - Track route status.

### Smart Contract Work

- Added initial Celo contract:
  - `contracts/SawerRegistry.sol`
- Current contract supports:
  - Creator handle registration.
  - Creator payout address storage.
  - Creator metadata URI storage.
  - Tip receipt event emission.

### UI Work

- Added first app screen for `SawerLink`.
- Current UI includes:
  - Product hero.
  - Destination chain display: Celo.
  - Stablecoin selector: `USDC`, `USDT`, `USDm`.
  - MiniPay connect button.
  - Generated creator link placeholder.
  - Three-step workflow: Create, Route, Receive.

### Verification

Completed successfully:

```bash
npm install
npm run typecheck
npm run lint
npm run build
```

Install result:

- `289` packages installed.
- `0` vulnerabilities reported.

### Local Dev Server

Dev server started successfully.

- Local URL: `http://localhost:5174/`
- Vite tried `5173`, but that port was already in use, so it selected `5174`.
- Logs:
  - `vite.stdout.log`
  - `vite.stderr.log`

### Current Next Steps

1. Add real creator profile form: handle, display name, bio, payout address.
2. Add routing page at `/s/:handle`.
3. Integrate LI.FI quote fetching.
4. Add wallet connection for non-MiniPay supporters.
5. Add contract deployment tooling.
6. Deploy contract to Celo Sepolia first, then Celo Mainnet.
7. Test MiniPay on a physical phone through ngrok.

## April 26, 2026

### Strategy Decision

- Decided NOT to rush the April 26 (today) submission deadline.
- Targeting May Proof of Ship campaign instead (~30 day runway).
- Reason: avoid shipping a broken MVP; focus on quality + real on-chain activity.

### Foundry Project Initialized

- Installed Foundry `1.5.1-stable` via `foundryup` (binaries at `~/.foundry/bin`).
  - To use in a fresh shell: `export PATH="$HOME/.foundry/bin:$PATH"`.
- Restructured `contracts/` into a Foundry project:
  - Moved `SawerRegistry.sol` to `contracts/src/SawerRegistry.sol`.
  - Added `forge-std` as a git submodule at `contracts/lib/forge-std`.
  - Added `contracts/foundry.toml` with Celo Mainnet and Sepolia RPC endpoints + Etherscan/Blockscout verifier config.
  - Added `contracts/test/SawerRegistry.t.sol` with 6 unit tests + 2 fuzz tests.
  - Added `contracts/script/Deploy.s.sol` for deployment.
  - Added `contracts/.env.example` and `contracts/README.md`.
  - Updated root `.gitignore` to exclude `contracts/out/`, `cache/`, `broadcast/`, `.env`.

### Tests Verified

```bash
cd contracts
forge build   # OK (compiles with solc 0.8.24)
forge test    # 8 passed, 0 failed
forge coverage # SawerRegistry.sol: 100% lines, 100% statements, 100% branches, 100% funcs
```

### SawerRegistry Deployed to Celo Sepolia

- **Address:** `0x7132Ae4BF031bAe1260f32c467D1914E7DCda647`
- **Chain ID:** `11142220` (Celo Sepolia)
- **Tx:** `0xb3dd40e3288d7a2b07d3521c490a5a0e299c2aa92cbea0a1717622315f99f3a5`
- **Block:** `23883641`
- **Cost:** `0.030102050000602041 CELO` (~602K gas at 50 gwei)
- **Verified:** https://celo-sepolia.blockscout.com/address/0x7132ae4bf031bae1260f32c467d1914e7dcda647
- **Deployer:** `0x9684e7074A9098eE0b5fCefC590d8946950700F0` (SawerLink Dev)

Verification used Blockscout (etherscan-compatible API at `https://celo-sepolia.blockscout.com/api/`). Required `CELOSCAN_API_KEY=dummy` env var set since `foundry.toml` references it for Celo mainnet entry.

### Frontend Bindings

- Created `apps/web/src/lib/contract.ts`:
  - Typed ABI as `as const` for viem type inference.
  - `SAWER_REGISTRY_ADDRESS` map keyed by chain ID.
  - `SAWER_REGISTRY_DEPLOYMENT` metadata (tx hash, block, explorer URL).
  - `handleHash(handle)` helper for computing `bytes32` keys.
  - `getRegistryAddress(chainId)` accessor.
- Verified with `npm run typecheck` — compiles cleanly.

### First On-Chain Registration

- **Tx:** `0x42b8acd7d02c5601b6e6c246ca8d419339f281c8543701dca34fc63754d3b4ad`
- **Block:** `23884086`
- **Gas used:** `96041` (~`$0.0005` worth of test CELO)
- **Status:** Success
- **Handle registered:** `sawerlink`
- **handleHash:** `0x41234ff55bf3f05f8a4f30aced03efec8f0015964b9f0d9b76fefd110d30aecd`
- **Explorer:** https://celo-sepolia.blockscout.com/tx/0x42b8acd7d02c5601b6e6c246ca8d419339f281c8543701dca34fc63754d3b4ad

`CreatorRegistered` event emitted correctly. Verified via `cast call creatorsByHandle(bytes32)` — returns `(0x9684...700F0, "sawerlink", "", true)`.

This satisfies the Proof of Ship "onchain activity" requirement on testnet. Mainnet equivalent still needed for actual submission.

### Updated Roadmap

Following the 30-day plan to May submission. Current state: end of Week 1.

Week 2 next:
1. Add React Router (`/`, `/create`, `/s/:handle`).
2. Build `CreatePage` with form → calls `registerCreator` via viem `writeContract`.
3. Build `TipPage` reading creator from chain via `readContract`.
4. Add wallet connection for non-MiniPay supporters (viem `createWalletClient` with `custom(window.ethereum)`).
5. Test with MetaMask on desktop, then physical MiniPay via ngrok.
