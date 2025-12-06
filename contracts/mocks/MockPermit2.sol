// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "../../lib/permit2/src/SignatureTransfer.sol";
import "../../lib/permit2/src/AllowanceTransfer.sol";

/**
 * @title MockPermit2
 * @notice Simulate Uniswap's Permit2 contract.
 * @dev Internal testing utility contract for simulating Uniswap's Permit2 behavior.
 * 
 * @custom:company Cosine Labs Inc.
 * @custom:contact engineering@getcosine.app
 * @custom:url https://getcosine.app
 * @notice Copyright (c) 2025 Cosine Labs Inc.
 * @custom:license MIT
 */
contract MockPermit2 is SignatureTransfer, AllowanceTransfer {}