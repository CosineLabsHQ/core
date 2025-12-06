// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28; 

import "../../../lib/openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import "../interfaces/ICore.sol";
import "./Request.sol";

/**
 * @title EIP2612Request
 * @notice Provides EIP-712 signature verification for EIP-2612-based payment request.
 * @dev This contract abstracts out signature verification logic for a meta-transaction-style payment
 *      using the EIP-2612 permit standard (gasless approvals via off-chain signatures).
 * 
 * @custom:company Cosine Labs Inc.
 * @custom:contact engineering@getcosine.app
 * @custom:url https://getcosine.app
 * @notice Copyright (c) 2025 Cosine Labs Inc.
 * @custom:license MIT
 */
abstract contract EIP2612Request is Request  {
    using ECDSA for bytes32;

    /**
     * @notice The EIP712 type hash for the entire EIP2612 payment structure.
     * @dev Matches the format required to recreate the off-chain signed message.
     */
    bytes32 private constant EIP2612_PAYMENT_TYPEHASH = keccak256(
        "EIP2612Payment(EIP2612Permit permit,TransferDetails transferDetails,address signer,bytes32 transactionId)"
        "EIP2612Permit(EIP2612Permitted permitted,EIP2612Signature signature)"
        "EIP2612Permitted(address token,address spender,uint256 value,uint256 deadline)"
        "EIP2612Signature(uint8 v,bytes32 r,bytes32 s)"
        "TransferDetails(address to,uint160 requestedAmount)"
    );
    bytes32 private constant EIP2612PERMIT_TYPEHASH = keccak256("EIP2612Permit(EIP2612Permitted permitted,EIP2612Signature signature)EIP2612Permitted(address token,address spender,uint256 value,uint256 deadline)EIP2612Signature(uint8 v,bytes32 r,bytes32 s)");
    bytes32 private constant EIP2612PERMITTED_TYPEHASH = keccak256("EIP2612Permitted(address token,address spender,uint256 value,uint256 deadline)");
    bytes32 private constant EIP2612SIGNATURE_TYPEHASH = keccak256("EIP2612Signature(uint8 v,bytes32 r,bytes32 s)");
    
    /**
     * @notice Recovers the signer address from an EIP2612 payment request.
     * @dev Creates the structured hash and recovers the signer address.
     * 
     * @param _request The EIP2612 payment request.
     * @param _signature The signature to verify the request.
     * @return recoveredSigner The address recovered from the signature.
     */
    function _recoverSignerFromEIP2612Request(
        ICore.EIP2612Request calldata _request,
        bytes calldata _signature
    ) internal view returns (address) {
        bytes32 structHash = keccak256(abi.encode(
            EIP2612_PAYMENT_TYPEHASH,
            _hashEIP2612Permit(_request.permit),
            _hashTransferDetails(_request.transferDetails),
            _request.signer,
            _request.transactionId
        ));
        bytes32 hash = _hashTypedDataV4(structHash);
        address recoveredSigner = hash.recover(_signature);
        return recoveredSigner; 
    }

    /**
     * @notice Hashes an EIP2612Permit struct for EIP-712 compliance.
     * @param _permit The EIP2612 permit to hash.
     * @return The keccak256 hash of the permit.
     */
    function _hashEIP2612Permit(ICore.EIP2612Permit calldata _permit) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            EIP2612PERMIT_TYPEHASH,
            _hashEIP2612Permitted(_permit.permitted),
            _hashEIP2612Signature(_permit.signature)
        ));
    }

    /**
     * @notice Hashes an EIP2612Permitted struct for EIP-712 compliance.
     * @param _permitted The EIP2612 permitted data to hash.
     * @return The keccak256 hash of the permitted data.
     */
    function _hashEIP2612Permitted(ICore.EIP2612Permitted calldata _permitted) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            EIP2612PERMITTED_TYPEHASH,
            _permitted.token,
            _permitted.spender,
            _permitted.value,
            _permitted.deadline
        ));
    }

    /**
     * @notice Hashes an EIP2612Signature struct for EIP-712 compliance.
     * @param _signature The EIP2612 signature data to hash.
     * @return The keccak256 hash of the signature data.
     */
    function _hashEIP2612Signature(ICore.EIP2612Signature calldata _signature) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            EIP2612SIGNATURE_TYPEHASH,
            _signature.v,
            _signature.r,
            _signature.s
        ));
    }
}