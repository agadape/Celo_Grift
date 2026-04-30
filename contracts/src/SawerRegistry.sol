// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
}

interface IPoolAddressesProvider {
    function getPool() external view returns (address);
}

contract SawerRegistry {
    // ─── Errors ─────────────────────────────────────────────────────────────
    error HandleTaken();
    error UnknownCreator();
    error NotCreator();
    error NoValue();
    error UnexpectedValue();
    error TransferFailed();
    error SubsDisabled();
    error Insufficient();

    // ─── Types ──────────────────────────────────────────────────────────────
    enum YieldStrategy {
        WALLET,
        AAVE
    }

    struct Creator {
        address payoutAddress;
        string handle;
        string metadataURI;
        bool exists;
    }

    struct SubConfig {
        bool enabled;
        uint256 priceWei;
    }

    // ─── Storage ────────────────────────────────────────────────────────────
    /// Aave V3 PoolAddressesProvider — resolves to current Pool at call time,
    /// so this contract survives Aave Pool upgrades. address(0) disables yield.
    address public immutable POOL_PROVIDER;

    mapping(bytes32 => Creator) public creatorsByHandle;
    mapping(bytes32 => SubConfig) public subConfigs;
    mapping(bytes32 => mapping(address => uint256)) public subExpiry;
    mapping(bytes32 => YieldStrategy) public yieldStrategies;

    // ─── Events ─────────────────────────────────────────────────────────────
    event CreatorRegistered(
        address indexed creator,
        bytes32 indexed handleHash,
        string handle,
        string metadataURI
    );

    event MetadataUpdated(
        address indexed creator,
        bytes32 indexed handleHash,
        string metadataURI
    );

    event TipReceipt(
        address indexed creator,
        address indexed token,
        uint256 amount,
        string message,
        bytes32 indexed routeId
    );

    event SubConfigSet(bytes32 indexed handleHash, bool enabled, uint256 priceWei);

    event Subscribed(
        address indexed subscriber,
        address indexed creator,
        bytes32 indexed handleHash,
        uint256 expiresAt
    );

    event YieldStrategySet(bytes32 indexed handleHash, YieldStrategy strategy);
    event YieldDeposited(address indexed creator, address indexed token, uint256 amount);

    // ─── Init ───────────────────────────────────────────────────────────────
    /// @param poolProvider Aave v3 PoolAddressesProvider on this chain.
    /// Pass address(0) to disable yield routing (test/dev chains without Aave).
    constructor(address poolProvider) {
        POOL_PROVIDER = poolProvider;
    }

    // ─── Creator registry ───────────────────────────────────────────────────
    function registerCreator(string calldata handle, string calldata metadataURI) external {
        bytes32 hash = keccak256(bytes(handle));
        if (creatorsByHandle[hash].exists) revert HandleTaken();

        creatorsByHandle[hash] = Creator({
            payoutAddress: msg.sender,
            handle: handle,
            metadataURI: metadataURI,
            exists: true
        });

        emit CreatorRegistered(msg.sender, hash, handle, metadataURI);
    }

    function updateMetadata(string calldata handle, string calldata newMetadataURI) external {
        bytes32 hash = keccak256(bytes(handle));
        Creator storage creator = creatorsByHandle[hash];
        if (!creator.exists) revert UnknownCreator();
        if (creator.payoutAddress != msg.sender) revert NotCreator();

        creator.metadataURI = newMetadataURI;
        emit MetadataUpdated(msg.sender, hash, newMetadataURI);
    }

    function setYieldStrategy(string calldata handle, YieldStrategy strategy) external {
        bytes32 hash = keccak256(bytes(handle));
        Creator storage creator = creatorsByHandle[hash];
        if (!creator.exists) revert UnknownCreator();
        if (creator.payoutAddress != msg.sender) revert NotCreator();

        yieldStrategies[hash] = strategy;
        emit YieldStrategySet(hash, strategy);
    }

    // ─── Tipping ────────────────────────────────────────────────────────────
    /// Single-tx tip. Routes ERC-20 to Aave when creator has opted in,
    /// otherwise sends straight to creator's wallet. Native CELO always
    /// goes to wallet.
    function tip(
        string calldata handle,
        address token,
        uint256 amount,
        string calldata message,
        bytes32 routeId
    ) external payable {
        bytes32 hash = keccak256(bytes(handle));
        Creator memory creator = creatorsByHandle[hash];
        if (!creator.exists) revert UnknownCreator();

        uint256 actualAmount;

        if (token == address(0)) {
            // Native CELO
            if (msg.value == 0) revert NoValue();
            actualAmount = msg.value;
            (bool ok,) = creator.payoutAddress.call{value: msg.value}("");
            if (!ok) revert TransferFailed();
        } else {
            if (msg.value != 0) revert UnexpectedValue();
            actualAmount = amount;

            bool useYield = POOL_PROVIDER != address(0)
                && yieldStrategies[hash] == YieldStrategy.AAVE;

            if (useYield) {
                // Resolve current Pool (survives Aave upgrades).
                address pool = IPoolAddressesProvider(POOL_PROVIDER).getPool();
                // Pull funds in, supply to Aave on creator's behalf.
                if (!IERC20(token).transferFrom(msg.sender, address(this), amount)) {
                    revert TransferFailed();
                }
                IERC20(token).approve(pool, amount);
                try IAavePool(pool).supply(token, amount, creator.payoutAddress, 0) {
                    emit YieldDeposited(creator.payoutAddress, token, amount);
                } catch {
                    // Token not listed on Aave (or other failure) → fall back to wallet.
                    IERC20(token).approve(pool, 0);
                    if (!IERC20(token).transfer(creator.payoutAddress, amount)) {
                        revert TransferFailed();
                    }
                }
            } else {
                if (!IERC20(token).transferFrom(msg.sender, creator.payoutAddress, amount)) {
                    revert TransferFailed();
                }
            }
        }

        emit TipReceipt(creator.payoutAddress, token, actualAmount, message, routeId);
    }

    /// Receipt-only call for tips that arrived via cross-chain bridge.
    /// The actual asset movement happens off-contract; this just emits the log
    /// so the feed/leaderboard see it.
    function recordTip(
        string calldata handle,
        address token,
        uint256 amount,
        string calldata message,
        bytes32 routeId
    ) external {
        Creator memory creator = creatorsByHandle[keccak256(bytes(handle))];
        if (!creator.exists) revert UnknownCreator();
        emit TipReceipt(creator.payoutAddress, token, amount, message, routeId);
    }

    // ─── Subscriptions ──────────────────────────────────────────────────────
    function setSubConfig(string calldata handle, bool enabled, uint256 priceWei) external {
        bytes32 hash = keccak256(bytes(handle));
        Creator storage creator = creatorsByHandle[hash];
        if (!creator.exists) revert UnknownCreator();
        if (creator.payoutAddress != msg.sender) revert NotCreator();

        subConfigs[hash] = SubConfig(enabled, priceWei);
        emit SubConfigSet(hash, enabled, priceWei);
    }

    function subscribe(string calldata handle) external payable {
        bytes32 hash = keccak256(bytes(handle));
        Creator memory creator = creatorsByHandle[hash];
        if (!creator.exists) revert UnknownCreator();
        SubConfig memory cfg = subConfigs[hash];
        if (!cfg.enabled) revert SubsDisabled();
        if (msg.value < cfg.priceWei) revert Insufficient();

        uint256 base = subExpiry[hash][msg.sender];
        uint256 newExpiry;
        unchecked {
            newExpiry = (base > block.timestamp ? base : block.timestamp) + 30 days;
        }
        subExpiry[hash][msg.sender] = newExpiry;

        (bool ok,) = creator.payoutAddress.call{value: msg.value}("");
        if (!ok) revert TransferFailed();

        emit Subscribed(msg.sender, creator.payoutAddress, hash, newExpiry);
    }

    function isSubscriber(bytes32 handleHash, address viewer) external view returns (bool) {
        return subExpiry[handleHash][viewer] > block.timestamp;
    }
}
