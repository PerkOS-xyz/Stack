// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC8183} from "erc8183/ERC8183.sol";

/// @title PerkOS Agentic Commerce
/// @notice Deployable wrapper around the pinned ERC-8183 reference implementation.
/// @dev The upstream source is pinned as a git submodule. This named implementation
///      gives Stack a stable deployment artifact without modifying the draft protocol.
///      The optional authorization extension exceeds the EIP-170 runtime-size limit;
///      Stack prepares transactions for the client, provider, and evaluator to sign directly.
contract PerkOSAgenticCommerce is ERC8183 {}
