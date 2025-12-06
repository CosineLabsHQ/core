// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28; 

import "../../../lib/openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import "../interfaces/ICore.sol";
import "./Request.sol";

/**
 * @title Permit2Request
 * @notice Provides EIP-712 signature verification for Permit2-based payment request.
 * @dev This contract abstracts out signature verification logic for a meta-transaction-style payment
 *      using the Permit2 permit standard (gasless approvals via off-chain signatures).
 * 
 * @custom:company Cosine Labs Inc.
 * @custom:contact engineering@getcosine.app
 * @custom:url https://getcosine.app
 * @notice Copyright (c) 2025 Cosine Labs Inc.
 * @custom:license MIT
 */
abstract contract Permit2Request is Request  {
    using ECDSA for bytes32;

    /**
     * @notice The EIP712 type hash for the entire Permit2 payment structure.
     * @dev Matches the format required to recreate the off-chain signed message.
     */
    bytes32 private constant PERMIT2_PAYMENT_TYPEHASH = keccak256(
        "Permit2Payment(PermitSingle permit,TransferDetails transferDetails,address signer,bytes signature,bytes32 transactionId)"
        "PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)"
        "PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)"
        "TransferDetails(address to,uint160 requestedAmount)"
    );
    bytes32 private constant PERMITSINGLE_TYPEHASH = keccak256("PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)");
    bytes32 private constant PERMITDETAILS_TYPEHASH = keccak256("PermitDetails(address token,uint160 amount,uint48 expiration,uint48 nonce)");
    
    /**
     * @notice Recovers the signer address from an Permit2 payment request.
     * @dev Creates the structured hash and recovers the signer address.
     * 
     * @param _request The Permit2 payment request.
     * @param _signature The signature to verify the request.
     * @return recoveredSigner The address recovered from the signature.
     */
    function _recoverSignerFromPermit2Request(
        ICore.Permit2Request calldata _request,
        bytes calldata _signature
    ) internal view returns (address) {
        bytes32 structHash = keccak256(abi.encode(
            PERMIT2_PAYMENT_TYPEHASH,
            _hashPermitSingle(_request.permit),
            _hashTransferDetails(_request.transferDetails),
            _request.signer,
            keccak256(_request.signature),
            _request.transactionId
        ));
        bytes32 hash = _hashTypedDataV4(structHash);
        address recoveredSigner = hash.recover(_signature);
        return recoveredSigner;
    }

    /**
     * @notice Hashes a PermitSingle struct for EIP-712 compliance.
     * @param _permit The PermitSingle data to hash.
     * @return The keccak256 hash of the permit.
     */
    function _hashPermitSingle(IPermit2.PermitSingle calldata _permit) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            PERMITSINGLE_TYPEHASH,
            _hashPermitDetails(_permit.details),
            _permit.spender,
            _permit.sigDeadline
        ));
    }

    /**
     * @notice Hashes a PermitDetails struct for EIP-712 compliance.
     * @param _details The PermitDetails data to hash.
     * @return The keccak256 hash of the permit details.
     */
    function _hashPermitDetails(IPermit2.PermitDetails calldata _details) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            PERMITDETAILS_TYPEHASH,
            _details.token,
            _details.amount,
            _details.expiration,
            _details.nonce
        ));
    }
}