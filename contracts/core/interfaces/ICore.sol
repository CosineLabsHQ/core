// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../../../lib/permit2/src/interfaces/IPermit2.sol";

interface ICore {
    /// @notice Emits an event when transaction has been completed.
    event Paid(address indexed user, address indexed token, uint256 receivedAmount, bytes32 transactionId);

    /// @notice Emits an event when transaction amount has been refunded.
    event Refunded(address indexed user, address indexed token, uint256 receivedAmount, bytes32 transactionId);

    /// @notice Emits an event when user is blacklisted or unblacklisted.
    event Blacklisted(address indexed user);
    event UnBlacklisted(address indexed user);

    /// @notice Emits an event when recipient transferred. 
    event RecipientTransferred(address indexed oldRecipient, address indexed newRecipient);

    /// @notice Emits an event when token added, removed or updated.
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event TokenUpdated(address indexed token);

    /// @notice Emits an event when relayer added or removed.
    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);

    /**
     * @notice Token configuration.
     * 
     * @param token The address of the ERC20 token.
     * @param minAmount Minimum allowed amount for payments.
     * @param maxAmount Maximum allowed amount for payments.
     */
    struct Token {
        address token;
        uint256 minAmount;
        uint256 maxAmount;
    }

    /**
     * @notice Token configuration 0.
     * 
     * @param token The address of the ERC20 token.
     * @param minAmount Minimum allowed amount for payments.
     * @param maxAmount Maximum allowed amount for payments.
     * @param supported Indicates whether this token is supported.
     */
    struct Token0 {
        address token;
        uint256 minAmount;
        uint256 maxAmount;
        bool supported;
    }

    /**
     * @notice Records a payment transaction.
     * 
     * @param id Unique, namespaced transaction identifier.
     * @param from Address that initiated the transaction.
     * @param token ERC20 token used in the transaction.
     * @param requestedAmount Amount that was requested.
     * @param receivedAmount Actual amount received (after fees, rebase or deflate).
     * @param exists Tracks if the transaction exists to prevent duplicates.
     * @param refunded Tracks if the transaction has been refunded.
     */
    struct Transaction {
        bytes32 id;
        address from;
        address token;
        uint256 requestedAmount;
        uint256 receivedAmount;
        bool exists;
        bool refunded;
    }
    
    /**
     * @notice The token, and details required for a standard EIP-2612 permit() operation.
     * 
     * @param token The ERC20 token address.
     * @param spender The address that is being approved to spend.
     * @param value The amount approved to spend.
     * @param deadline The expiration timestamp of the permit.
     */
    struct EIP2612Permitted {
        address token;
        // address owner; // replaced with EIP2612Request.signer
        address spender;
        uint256 value;
        uint256 deadline;
    }

    /**
     * @notice Signature parameters for an EIP-2612 permit (v, r, s).
     * 
     * @param v The 'v' component of the signature.
     * @param r The 'r' component of the signature.
     * @param s The 's' component of the signature.
     */
    struct EIP2612Signature {
        uint8 v; 
        bytes32 r; 
        bytes32 s; 
    }
    
    /**
     * @notice Full EIP-2612 permit object containing token, permission and signature.
     * 
     * @param permitted The permit details.
     * @param signature The EIP2612-compatible signature.
     */
    struct EIP2612Permit {
        EIP2612Permitted permitted;
        EIP2612Signature signature;
    }

    /**
     * @notice The payment recipient and requested amount.
     * 
     * @param to The recipient of the transfer.
     * @param requestedAmount The requested amount (may differ from actual received).
     */
    struct TransferDetails {
        address to;
        uint160 requestedAmount;
    }

    /**
     * @notice The EIP2612 payment request.
     * 
     * @param permit The permit data signed by the token holder.
     * @param transferDetails The transfer details including recipient and amount.
     * @param signer The address that signed the permit and owns the tokens.
     * @param transactionId The unique off-chain transaction identifier.
     */
    struct EIP2612Request {
        ICore.EIP2612Permit permit;
        ICore.TransferDetails transferDetails;
        address signer;
        bytes32 transactionId;
    }

    /**
     * @notice The Permit2 payment request.
     *
     * @param permit The Permit2 data signed by the token holder.
     * @param transferDetails The requested transfer details including recipient and requested amount.
     * @param signer The address that signed the permit and owns the tokens.
     * @param signature The cryptographic signature used to verify the permit.
     * @param transactionId The unique off-chain transaction identifier.
     */
    struct Permit2Request {
        IPermit2.PermitSingle permit;
        ICore.TransferDetails transferDetails;
        address signer;
        bytes signature;
        bytes32 transactionId;
    }
}