// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SawerRegistry {
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
}
