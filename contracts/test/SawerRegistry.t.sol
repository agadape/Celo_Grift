// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SawerRegistry} from "../src/SawerRegistry.sol";

contract SawerRegistryTest is Test {
    SawerRegistry internal registry;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal usdc = makeAddr("usdc");

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

    function setUp() public {
        registry = new SawerRegistry();
    }

    // ── registerCreator ────────────────────────────────────────────────────

    function test_RegisterCreator_HappyPath() public {
        vm.prank(alice);

        vm.expectEmit(true, true, true, true);
        emit CreatorRegistered(alice, keccak256(bytes("alice")), "alice", "ipfs://meta");

        registry.registerCreator("alice", "ipfs://meta");

        (address payout, string memory handle, string memory metadataURI, bool exists) =
            registry.creatorsByHandle(keccak256(bytes("alice")));

        assertEq(payout, alice);
        assertEq(handle, "alice");
        assertEq(metadataURI, "ipfs://meta");
        assertTrue(exists);
    }

    function test_RegisterCreator_AcceptsEmptyMetadata() public {
        vm.prank(alice);
        registry.registerCreator("alice", "");

        (,, string memory metadataURI, bool exists) =
            registry.creatorsByHandle(keccak256(bytes("alice")));

        assertEq(metadataURI, "");
        assertTrue(exists);
    }

    function test_RegisterCreator_RevertsOnDuplicateHandle() public {
        vm.prank(alice);
        registry.registerCreator("alice", "");

        vm.prank(bob);
        vm.expectRevert(bytes("HANDLE_TAKEN"));
        registry.registerCreator("alice", "");
    }

    function test_RegisterCreator_DifferentHandlesAllowed() public {
        vm.prank(alice);
        registry.registerCreator("alice", "");

        vm.prank(bob);
        registry.registerCreator("bob", "");

        (address aliceAddr,,,) = registry.creatorsByHandle(keccak256(bytes("alice")));
        (address bobAddr,,,) = registry.creatorsByHandle(keccak256(bytes("bob")));

        assertEq(aliceAddr, alice);
        assertEq(bobAddr, bob);
    }

    // ── updateMetadata ─────────────────────────────────────────────────────

    function test_UpdateMetadata_HappyPath() public {
        vm.prank(alice);
        registry.registerCreator("alice", "ipfs://old");

        vm.expectEmit(true, true, true, true);
        emit MetadataUpdated(alice, keccak256(bytes("alice")), "ipfs://new");

        vm.prank(alice);
        registry.updateMetadata("alice", "ipfs://new");

        (,, string memory metadataURI,) = registry.creatorsByHandle(keccak256(bytes("alice")));
        assertEq(metadataURI, "ipfs://new");
    }

    function test_UpdateMetadata_RevertsOnUnknownHandle() public {
        vm.prank(alice);
        vm.expectRevert(bytes("UNKNOWN_CREATOR"));
        registry.updateMetadata("ghost", "ipfs://new");
    }

    function test_UpdateMetadata_RevertsIfNotCreator() public {
        vm.prank(alice);
        registry.registerCreator("alice", "ipfs://old");

        vm.prank(bob);
        vm.expectRevert(bytes("NOT_CREATOR"));
        registry.updateMetadata("alice", "ipfs://stolen");
    }

    function test_UpdateMetadata_AcceptsEmptyURI() public {
        vm.prank(alice);
        registry.registerCreator("alice", "ipfs://old");

        vm.prank(alice);
        registry.updateMetadata("alice", "");

        (,, string memory metadataURI,) = registry.creatorsByHandle(keccak256(bytes("alice")));
        assertEq(metadataURI, "");
    }

    // ── recordTip ──────────────────────────────────────────────────────────

    function test_RecordTip_EmitsEvent() public {
        vm.prank(alice);
        registry.registerCreator("alice", "");

        bytes32 routeId = keccak256("some-lifi-route-id");

        vm.expectEmit(true, true, true, true);
        emit TipReceipt(alice, usdc, 1_000_000, "thanks for streaming!", routeId);

        vm.prank(bob);
        registry.recordTip("alice", usdc, 1_000_000, "thanks for streaming!", routeId);
    }

    function test_RecordTip_RevertsOnUnknownCreator() public {
        bytes32 routeId = keccak256("any");

        vm.expectRevert(bytes("UNKNOWN_CREATOR"));
        registry.recordTip("ghost", usdc, 100, "hi", routeId);
    }

    // ── fuzz ───────────────────────────────────────────────────────────────

    function testFuzz_RegisterCreator_AcceptsAnyHandle(string calldata handle) public {
        vm.assume(bytes(handle).length > 0);
        vm.assume(bytes(handle).length < 100);

        vm.prank(alice);
        registry.registerCreator(handle, "");

        (,,, bool exists) = registry.creatorsByHandle(keccak256(bytes(handle)));
        assertTrue(exists);
    }

    function testFuzz_RecordTip_AnyAmount(uint256 amount) public {
        vm.prank(alice);
        registry.registerCreator("alice", "");

        bytes32 routeId = keccak256("route");

        vm.expectEmit(true, true, true, true);
        emit TipReceipt(alice, usdc, amount, "msg", routeId);

        registry.recordTip("alice", usdc, amount, "msg", routeId);
    }

    function testFuzz_UpdateMetadata_AnyURI(string calldata uri) public {
        vm.prank(alice);
        registry.registerCreator("alice", "");

        vm.prank(alice);
        registry.updateMetadata("alice", uri);

        (,, string memory metadataURI,) = registry.creatorsByHandle(keccak256(bytes("alice")));
        assertEq(metadataURI, uri);
    }
}
