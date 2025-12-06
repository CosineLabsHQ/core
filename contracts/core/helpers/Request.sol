// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28; 

import "../../../lib/openzeppelin-contracts/contracts/utils/cryptography/EIP712.sol";
import "../../../lib/openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import "../../../lib/permit2/src/interfaces/IPermit2.sol";
import "../interfaces/ICore.sol";

/**
 * @title Request
 * @notice  Base contract providing EIP‑712 typed-data hashing support for payment request signatures.
 * @dev Inherits EIP712 implementation.
 * 
 * @custom:company Cosine Labs Inc.
 * @custom:contact engineering@getcosine.app
 * @custom:url https://getcosine.app
 * @notice Copyright (c) 2025 Cosine Labs Inc.
 * @custom:license MIT
 */
abstract contract Request is EIP712 {
    string private constant DOMAIN_NAME = "Core";
    string private constant DOMAIN_VERSION = "1";

    bytes32 private constant TRANSFERDETAILS_TYPEHASH = keccak256("TransferDetails(address to,uint160 requestedAmount)");

    constructor() EIP712(DOMAIN_NAME, DOMAIN_VERSION) {}

    /**
     * @notice Hashes a TransferDetails struct for EIP-712 compliance.
     * @param _transferDetails The transfer details to hash.
     * @return The keccak256 hash of the transfer details.
     */
    function _hashTransferDetails(ICore.TransferDetails calldata _transferDetails) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            TRANSFERDETAILS_TYPEHASH,
            _transferDetails.to,
            _transferDetails.requestedAmount
        ));
    }
}