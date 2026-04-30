// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SawerRegistry} from "../src/SawerRegistry.sol";

contract MockERC20 {
    string public name = "Mock";
    string public symbol = "MOCK";
    uint8 public decimals = 18;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "BAL");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "ALLOW");
        require(balanceOf[from] >= amount, "BAL");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockAavePool {
    bool public shouldRevert;

    function setShouldRevert(bool v) external {
        shouldRevert = v;
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
        if (shouldRevert) revert("LISTING");
        // Pull tokens from caller (mimics Aave behaviour)
        MockERC20(asset).transferFrom(msg.sender, address(this), amount);
        // Pretend to mint aTokens (we just credit the onBehalfOf — for accounting only)
        MockERC20(asset).transfer(onBehalfOf, amount);
    }
}

contract MockPoolProvider {
    address public pool;
    constructor(address _pool) {
        pool = _pool;
    }
    function getPool() external view returns (address) {
        return pool;
    }
}

contract SawerRegistryTest is Test {
    SawerRegistry internal registry;
    MockERC20 internal cusd;
    MockAavePool internal aave;

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

    event YieldDeposited(address indexed creator, address indexed token, uint256 amount);

    function setUp() public {
        registry = new SawerRegistry(address(0));
        cusd = new MockERC20();
        aave = new MockAavePool();
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

    function test_RegisterCreator_RevertsOnDuplicateHandle() public {
        vm.prank(alice);
        registry.registerCreator("alice", "");

        vm.prank(bob);
        vm.expectRevert(SawerRegistry.HandleTaken.selector);
        registry.registerCreator("alice", "");
    }

    // ── updateMetadata ─────────────────────────────────────────────────────

    function test_UpdateMetadata_HappyPath() public {
        vm.prank(alice);
        registry.registerCreator("alice", "ipfs://old");

        vm.expectEmit(true, true, true, true);
        emit MetadataUpdated(alice, keccak256(bytes("alice")), "ipfs://new");

        vm.prank(alice);
        registry.updateMetadata("alice", "ipfs://new");
    }

    function test_UpdateMetadata_RevertsOnUnknownHandle() public {
        vm.prank(alice);
        vm.expectRevert(SawerRegistry.UnknownCreator.selector);
        registry.updateMetadata("ghost", "ipfs://new");
    }

    function test_UpdateMetadata_RevertsIfNotCreator() public {
        vm.prank(alice);
        registry.registerCreator("alice", "ipfs://old");

        vm.prank(bob);
        vm.expectRevert(SawerRegistry.NotCreator.selector);
        registry.updateMetadata("alice", "ipfs://stolen");
    }

    // ── tip (native) ───────────────────────────────────────────────────────

    function test_TipNative_HappyPath() public {
        vm.prank(alice);
        registry.registerCreator("alice", "");

        vm.deal(bob, 10 ether);
        uint256 aliceBalBefore = alice.balance;

        vm.expectEmit(true, true, true, true);
        emit TipReceipt(alice, address(0), 0.5 ether, "ty", bytes32(0));

        vm.prank(bob);
        registry.tip{value: 0.5 ether}("alice", address(0), 0.5 ether, "ty", bytes32(0));

        assertEq(alice.balance, aliceBalBefore + 0.5 ether);
    }

    function test_TipNative_RevertsZeroValue() public {
        vm.prank(alice);
        registry.registerCreator("alice", "");

        vm.prank(bob);
        vm.expectRevert(SawerRegistry.NoValue.selector);
        registry.tip("alice", address(0), 0, "", bytes32(0));
    }

    // ── tip (ERC-20 → wallet) ──────────────────────────────────────────────

    function test_TipErc20_HappyPath() public {
        vm.prank(alice);
        registry.registerCreator("alice", "");

        cusd.mint(bob, 1000e18);
        vm.prank(bob);
        cusd.approve(address(registry), 100e18);

        vm.prank(bob);
        registry.tip("alice", address(cusd), 10e18, "thanks", bytes32(0));

        assertEq(cusd.balanceOf(alice), 10e18);
        assertEq(cusd.balanceOf(bob), 990e18);
    }

    function test_TipErc20_RevertsIfValueSent() public {
        vm.prank(alice);
        registry.registerCreator("alice", "");

        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(SawerRegistry.UnexpectedValue.selector);
        registry.tip{value: 0.1 ether}("alice", address(cusd), 10e18, "x", bytes32(0));
    }

    // ── tip (ERC-20 → Aave) ────────────────────────────────────────────────

    function test_TipErc20_RoutesToAaveWhenEnabled() public {
        MockPoolProvider provider = new MockPoolProvider(address(aave));
        SawerRegistry r = new SawerRegistry(address(provider));

        vm.prank(alice);
        r.registerCreator("alice", "");
        vm.prank(alice);
        r.setYieldStrategy("alice", SawerRegistry.YieldStrategy.AAVE);

        cusd.mint(bob, 1000e18);
        vm.prank(bob);
        cusd.approve(address(r), 100e18);

        vm.expectEmit(true, true, false, true);
        emit YieldDeposited(alice, address(cusd), 10e18);

        vm.prank(bob);
        r.tip("alice", address(cusd), 10e18, "thanks", bytes32(0));

        // Mock pool credits onBehalfOf with the supplied tokens (= aToken stand-in)
        assertEq(cusd.balanceOf(alice), 10e18);
    }

    function test_TipErc20_FallsBackToWalletIfAaveReverts() public {
        MockPoolProvider provider = new MockPoolProvider(address(aave));
        SawerRegistry r = new SawerRegistry(address(provider));
        aave.setShouldRevert(true);

        vm.prank(alice);
        r.registerCreator("alice", "");
        vm.prank(alice);
        r.setYieldStrategy("alice", SawerRegistry.YieldStrategy.AAVE);

        cusd.mint(bob, 1000e18);
        vm.prank(bob);
        cusd.approve(address(r), 100e18);

        vm.prank(bob);
        r.tip("alice", address(cusd), 10e18, "fallback", bytes32(0));

        // Tokens still landed at alice
        assertEq(cusd.balanceOf(alice), 10e18);
    }

    // ── recordTip (cross-chain receipt) ────────────────────────────────────

    function test_RecordTip_EmitsEvent() public {
        vm.prank(alice);
        registry.registerCreator("alice", "");

        vm.expectEmit(true, true, true, true);
        emit TipReceipt(alice, usdc, 1_000_000, "ty", keccak256("rid"));

        vm.prank(bob);
        registry.recordTip("alice", usdc, 1_000_000, "ty", keccak256("rid"));
    }

    function test_RecordTip_RevertsOnUnknownCreator() public {
        vm.expectRevert(SawerRegistry.UnknownCreator.selector);
        registry.recordTip("ghost", usdc, 100, "hi", keccak256("x"));
    }

    // ── subscriptions ──────────────────────────────────────────────────────

    function test_Subscribe_StackingExtendsExpiry() public {
        vm.prank(alice);
        registry.registerCreator("alice", "");
        vm.prank(alice);
        registry.setSubConfig("alice", true, 1 ether);

        vm.deal(bob, 5 ether);

        vm.prank(bob);
        registry.subscribe{value: 1 ether}("alice");

        uint256 firstExpiry = registry.subExpiry(keccak256(bytes("alice")), bob);
        assertEq(firstExpiry, block.timestamp + 30 days);

        vm.prank(bob);
        registry.subscribe{value: 1 ether}("alice");

        uint256 secondExpiry = registry.subExpiry(keccak256(bytes("alice")), bob);
        assertEq(secondExpiry, firstExpiry + 30 days);
    }

    function test_Subscribe_RevertsBelowPrice() public {
        vm.prank(alice);
        registry.registerCreator("alice", "");
        vm.prank(alice);
        registry.setSubConfig("alice", true, 1 ether);

        vm.deal(bob, 5 ether);
        vm.prank(bob);
        vm.expectRevert(SawerRegistry.Insufficient.selector);
        registry.subscribe{value: 0.5 ether}("alice");
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
}
