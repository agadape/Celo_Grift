// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract SawerRegistry {
    // ─── Creator ────────────────────────────────────────────────────────────
    struct Creator {
        address payoutAddress;
        string handle;
        string metadataURI;
        bool exists;
    }

    mapping(bytes32 => Creator) public creatorsByHandle;

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

    function registerCreator(
        string calldata handle,
        string calldata metadataURI
    ) external {
        bytes32 hash = keccak256(bytes(handle));
        require(!creatorsByHandle[hash].exists, "HANDLE_TAKEN");

        creatorsByHandle[hash] = Creator({
            payoutAddress: msg.sender,
            handle: handle,
            metadataURI: metadataURI,
            exists: true
        });

        emit CreatorRegistered(msg.sender, hash, handle, metadataURI);
    }

    function updateMetadata(
        string calldata handle,
        string calldata newMetadataURI
    ) external {
        bytes32 hash = keccak256(bytes(handle));
        Creator storage creator = creatorsByHandle[hash];
        require(creator.exists, "UNKNOWN_CREATOR");
        require(creator.payoutAddress == msg.sender, "NOT_CREATOR");

        creator.metadataURI = newMetadataURI;

        emit MetadataUpdated(msg.sender, hash, newMetadataURI);
    }

    // Single-tx tip: transfers funds + emits receipt atomically.
    // token == address(0) → native CELO (send msg.value); otherwise ERC-20 transferFrom.
    function tip(
        string calldata handle,
        address token,
        uint256 amount,
        string calldata message,
        bytes32 routeId
    ) external payable {
        bytes32 hash = keccak256(bytes(handle));
        Creator memory creator = creatorsByHandle[hash];
        require(creator.exists, "UNKNOWN_CREATOR");

        uint256 actualAmount;
        if (token == address(0)) {
            require(msg.value > 0, "NO_VALUE");
            actualAmount = msg.value;
            (bool ok,) = creator.payoutAddress.call{value: msg.value}("");
            require(ok, "TRANSFER_FAILED");
        } else {
            require(msg.value == 0, "UNEXPECTED_VALUE");
            actualAmount = amount;
            require(IERC20(token).transferFrom(msg.sender, creator.payoutAddress, amount), "TRANSFER_FAILED");
        }

        emit TipReceipt(creator.payoutAddress, token, actualAmount, message, routeId);
    }

    // Kept for backwards-compatibility with older frontends.
    function recordTip(
        string calldata handle,
        address token,
        uint256 amount,
        string calldata message,
        bytes32 routeId
    ) external {
        Creator memory creator = creatorsByHandle[keccak256(bytes(handle))];
        require(creator.exists, "UNKNOWN_CREATOR");

        emit TipReceipt(
            creator.payoutAddress,
            token,
            amount,
            message,
            routeId
        );
    }

    // ─── Subscriptions ──────────────────────────────────────────────────────
    struct SubConfig {
        bool enabled;
        uint256 priceWei; // monthly price in native CELO
    }

    // handleHash => subscriber address => expiry timestamp
    mapping(bytes32 => mapping(address => uint256)) public subExpiry;
    mapping(bytes32 => SubConfig) public subConfigs;

    event SubConfigSet(
        bytes32 indexed handleHash,
        bool enabled,
        uint256 priceWei
    );

    event Subscribed(
        address indexed subscriber,
        address indexed creator,
        bytes32 indexed handleHash,
        uint256 expiresAt
    );

    function setSubConfig(
        string calldata handle,
        bool enabled,
        uint256 priceWei
    ) external {
        bytes32 hash = keccak256(bytes(handle));
        Creator storage creator = creatorsByHandle[hash];
        require(creator.exists, "UNKNOWN_CREATOR");
        require(creator.payoutAddress == msg.sender, "NOT_CREATOR");

        subConfigs[hash] = SubConfig(enabled, priceWei);
        emit SubConfigSet(hash, enabled, priceWei);
    }

    function subscribe(string calldata handle) external payable {
        bytes32 hash = keccak256(bytes(handle));
        Creator memory creator = creatorsByHandle[hash];
        require(creator.exists, "UNKNOWN_CREATOR");
        SubConfig memory cfg = subConfigs[hash];
        require(cfg.enabled, "SUBS_DISABLED");
        require(msg.value >= cfg.priceWei, "INSUFFICIENT");

        // Stack time if already subscribed
        uint256 base = subExpiry[hash][msg.sender] > block.timestamp
            ? subExpiry[hash][msg.sender]
            : block.timestamp;
        uint256 newExpiry = base + 30 days;
        subExpiry[hash][msg.sender] = newExpiry;

        // Forward payment directly to creator (checks-effects-interactions)
        (bool ok,) = creator.payoutAddress.call{value: msg.value}("");
        require(ok, "TRANSFER_FAILED");

        emit Subscribed(msg.sender, creator.payoutAddress, hash, newExpiry);
    }

    function isSubscriber(bytes32 handleHash, address viewer)
        external
        view
        returns (bool)
    {
        return subExpiry[handleHash][viewer] > block.timestamp;
    }
}
