// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC8183WithAuthorization} from "erc8183/ERC8183WithAuthorization.sol";

/// @title PerkOS Agentic Commerce
/// @notice Pinned ERC-8183 reference implementation with EIP-712 relay authorization.
/// @dev The upstream source is pinned as a git submodule. This named implementation
///      gives Stack a stable deployment artifact without modifying the draft protocol.
contract PerkOSAgenticCommerce is ERC8183WithAuthorization {}
