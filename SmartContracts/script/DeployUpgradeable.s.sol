// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/DeferredPaymentEscrowUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployUpgradeable is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("\n========================================");
        console.log("Deploying Upgradeable DeferredPaymentEscrow");
        console.log("========================================");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("========================================\n");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy implementation
        console.log("Deploying implementation contract...");
        DeferredPaymentEscrowUpgradeable implementation = new DeferredPaymentEscrowUpgradeable();
        console.log("Implementation deployed at:", address(implementation));

        // Prepare initialization data
        bytes memory initializeData = abi.encodeWithSelector(
            DeferredPaymentEscrowUpgradeable.initialize.selector,
            deployer
        );

        // Deploy proxy
        console.log("\nDeploying UUPS Proxy...");
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initializeData
        );
        console.log("Proxy deployed at:", address(proxy));

        // Get contract instance through proxy
        DeferredPaymentEscrowUpgradeable escrow = DeferredPaymentEscrowUpgradeable(
            address(proxy)
        );

        // Verify deployment
        console.log("\nVerifying deployment...");
        string memory version = escrow.version();
        address owner = escrow.owner();
        console.log("Contract version:", version);
        console.log("Contract owner:", owner);

        vm.stopBroadcast();

        console.log("\n========================================");
        console.log("DEPLOYMENT SUMMARY");
        console.log("========================================");
        console.log("Network Chain ID:", block.chainid);
        console.log("Implementation:", address(implementation));
        console.log("Proxy (Use this address):", address(proxy));
        console.log("Owner:", owner);
        console.log("========================================\n");

        console.log("Add this to your .env file:");
        console.log("========================================");
        _printEnvVar(block.chainid, address(proxy));
        console.log("NEXT_PUBLIC_DEFERRED_ENABLED=true");
        console.log("========================================\n");
    }

    function _printEnvVar(uint256 chainId, address proxyAddress) internal pure {
        if (chainId == 43114) {
            console.log("NEXT_PUBLIC_AVALANCHE_ESCROW_ADDRESS=", proxyAddress);
        } else if (chainId == 43113) {
            console.log("NEXT_PUBLIC_AVALANCHE_FUJI_ESCROW_ADDRESS=", proxyAddress);
        } else if (chainId == 8453) {
            console.log("NEXT_PUBLIC_BASE_ESCROW_ADDRESS=", proxyAddress);
        } else if (chainId == 84532) {
            console.log("NEXT_PUBLIC_BASE_SEPOLIA_ESCROW_ADDRESS=", proxyAddress);
        } else if (chainId == 42220) {
            console.log("NEXT_PUBLIC_CELO_ESCROW_ADDRESS=", proxyAddress);
        } else if (chainId == 11142220) {
            console.log("NEXT_PUBLIC_CELO_SEPOLIA_ESCROW_ADDRESS=", proxyAddress);
        } else {
            console.log("NEXT_PUBLIC_ESCROW_ADDRESS=", proxyAddress);
        }
    }
}
