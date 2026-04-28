// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SawerRegistry} from "../src/SawerRegistry.sol";

contract Deploy is Script {
    function run() external returns (SawerRegistry registry) {
        vm.startBroadcast();
        registry = new SawerRegistry();
        vm.stopBroadcast();

        console.log("SawerRegistry deployed at:", address(registry));
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", msg.sender);
    }
}
