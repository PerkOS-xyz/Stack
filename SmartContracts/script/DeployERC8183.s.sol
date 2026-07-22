// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {PerkOSAgenticCommerce} from "../src/erc8183/PerkOSAgenticCommerce.sol";

contract DeployERC8183 is Script {
    function run() external returns (address implementation, address proxy) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address admin = vm.envOr("ERC8183_ADMIN", deployer);
        address treasury = vm.envOr("ERC8183_TREASURY", admin);
        address paymentToken = vm.envAddress("ERC8183_PAYMENT_TOKEN");

        vm.startBroadcast(deployerKey);
        PerkOSAgenticCommerce deployedImplementation = new PerkOSAgenticCommerce();
        ERC1967Proxy deployedProxy = new ERC1967Proxy(
            address(deployedImplementation), abi.encodeWithSignature("initialize(address,address)", treasury, admin)
        );

        if (deployer != admin) vm.stopBroadcast();
        if (deployer != admin) vm.startBroadcast(vm.envUint("ERC8183_ADMIN_PRIVATE_KEY"));
        PerkOSAgenticCommerce(address(deployedProxy)).setPaymentTokenAllowed(paymentToken, true);
        vm.stopBroadcast();

        implementation = address(deployedImplementation);
        proxy = address(deployedProxy);
        console2.log("ERC-8183 implementation", implementation);
        console2.log("ERC-8183 proxy", proxy);
        console2.log("Allowed payment token", paymentToken);
    }
}
