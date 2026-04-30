// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SawerRegistry} from "../src/SawerRegistry.sol";

contract Deploy is Script {
    // Aave V3 PoolAddressesProvider per chain. The provider is a stable proxy
    // that returns the current Pool implementation, so this address survives
    // Aave Pool upgrades. address(0) = no yield routing on this chain.
    //
    // Source: https://github.com/bgd-labs/aave-address-book — AaveV3Celo.sol
    address constant AAVE_PROVIDER_CELO = 0x9F7Cf9417D5251C59fE94fB9147feEe1aAd9Cea5;

    function run() external returns (SawerRegistry registry) {
        address poolProvider;
        if (block.chainid == 42220) {
            poolProvider = AAVE_PROVIDER_CELO;
        } else {
            poolProvider = address(0); // Sepolia / local: yield disabled
        }

        vm.startBroadcast();
        registry = new SawerRegistry(poolProvider);
        vm.stopBroadcast();

        console.log("SawerRegistry deployed at:", address(registry));
        console.log("Chain ID:", block.chainid);
        console.log("Aave Pool Provider:", poolProvider);
        console.log("Deployer:", msg.sender);
    }
}
