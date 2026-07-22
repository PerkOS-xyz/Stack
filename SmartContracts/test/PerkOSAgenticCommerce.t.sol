// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC8183} from "erc8183/ERC8183.sol";
import {MockUSDC} from "erc8183/mocks/MockUSDC.sol";
import {PerkOSAgenticCommerce} from "../src/erc8183/PerkOSAgenticCommerce.sol";

contract PerkOSAgenticCommerceTest is Test {
    PerkOSAgenticCommerce internal commerce;
    MockUSDC internal token;

    address internal client = makeAddr("client");
    address internal provider = makeAddr("provider");
    address internal evaluator = makeAddr("evaluator");

    function setUp() public {
        PerkOSAgenticCommerce implementation = new PerkOSAgenticCommerce();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeWithSignature("initialize(address,address)", address(this), address(this))
        );
        commerce = PerkOSAgenticCommerce(address(proxy));
        token = new MockUSDC();
        commerce.setPaymentTokenAllowed(address(token), true);
        token.mint(client, 100e6);
    }

    function testFullJobLifecycle() public {
        vm.prank(client);
        uint256 jobId = commerce.createJob(
            provider,
            evaluator,
            uint48(block.timestamp + 1 days),
            "Execute a bounded stock-token mandate",
            address(0),
            42
        );

        vm.prank(provider);
        commerce.setBudget(jobId, address(token), 10e6, "");

        vm.startPrank(client);
        token.approve(address(commerce), 10e6);
        commerce.fund(jobId, address(token), 10e6, "");
        vm.stopPrank();

        bytes32 deliverable = keccak256("mandatemesh-run-evidence");
        vm.prank(provider);
        commerce.submit(jobId, deliverable, "");

        vm.prank(evaluator);
        commerce.complete(jobId, keccak256("risk-approved"), "");

        assertEq(token.balanceOf(provider), 10e6);
        assertEq(uint8(commerce.getJob(jobId).status), uint8(ERC8183.JobStatus.Completed));
    }

    function testRejectRefundsClient() public {
        vm.prank(client);
        uint256 jobId = commerce.createJob(
            provider, evaluator, uint48(block.timestamp + 1 days), "Reject unsafe execution", address(0), 42
        );
        vm.prank(provider);
        commerce.setBudget(jobId, address(token), 10e6, "");
        vm.startPrank(client);
        token.approve(address(commerce), 10e6);
        commerce.fund(jobId, address(token), 10e6, "");
        vm.stopPrank();

        vm.prank(evaluator);
        commerce.reject(jobId, keccak256("risk-rejected"), "");

        assertEq(token.balanceOf(client), 100e6);
        assertEq(uint8(commerce.getJob(jobId).status), uint8(ERC8183.JobStatus.Rejected));
    }
}
