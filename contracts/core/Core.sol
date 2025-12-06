// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../../lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "../../lib/openzeppelin-contracts/contracts/utils/Pausable.sol";
import "../../lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import "../../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "../../lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../../lib/openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "../../lib/permit2/src/interfaces/IPermit2.sol";
import "./helpers/EIP2612Request.sol";
import "./helpers/Permit2Request.sol";
import "./helpers/Request.sol";
import "./interfaces/ICore.sol";

/**
 * @title Core
 * @notice Core is a gasless payment protocol that enables token transfers using EIP-2612 Permit and Permit2 standards without requiring prior on-chain approvals.
 * @dev Inherits from Ownable for access control, Pausable for emergency stops, ReentrancyGuard to prevent reentrant calls, and EIP712/{ECDSA-recover} for payment request verification.
 * 
 * @custom:company Cosine Labs Inc.
 * @custom:contact engineering@getcosine.app
 * @custom:url https://getcosine.app
 * @notice Copyright (c) 2025 Cosine Labs Inc.
 * @custom:license MIT
 */
contract Core is Ownable, Pausable, ReentrancyGuard, Request, EIP2612Request, Permit2Request {
    ICore.Token[] public tokens;
    address[] public relayers;
    IPermit2 public immutable permit2;
    address public recipient;

    mapping(address => ICore.Token0) public tokenRegistry;
    mapping(address => bool) public relayerRegistry;
    mapping(address => bool) public blacklistRegistry;
    mapping(address => mapping(bytes32 => ICore.Transaction)) transactionRegistry;
    mapping(address => uint256) public volumeRegistry;

    /**
     * @notice Deploys the Core contract and sets the initial configuration.
     * @dev Initializes supported tokens, relayers, Permit2, recipient, and contract owner.
     * 
     * @param _tokens An array of ERC20 tokens supported by the contract.
     * @param _relayers The addresses authorized to relay transactions.
     * @param _permit2 The address of the Permit2 contract.
     * @param _recipient The address that receives the payments (multi-sig wallet).
     * @param _owner The owner of the contract (multi-sig wallet).
     */
    constructor(
        ICore.Token[] memory _tokens,
        address[] memory _relayers,
        address _permit2,
        address _recipient,
        address _owner
    ) Ownable(_owner) Request() {
        for (uint256 i = 0; i < _tokens.length; i++) {
            _addToken(_tokens[i]);
        }
        for (uint256 i = 0; i < _relayers.length; i++) {
            _addRelayer(_relayers[i]);
        }
        permit2 = IPermit2(_permit2);
        recipient = _recipient;
    }
  
    /**
     * @notice Restricts function access to the designated relayer addresses.
     * @dev Reverts if the caller is not the relayer address.
     */
    modifier onlyRelayer() {
        require(relayerRegistry[_msgSender()], "not relayer");
        _;
    }

    /**
     * @notice Executes a token payment using EIP-2612 permit-based authorization.
     * @dev Supports both gasless (relayer-submitted) and gas (user-submitted) requests.
     *      For gasless, the relayer submits the transaction on behalf of the user.
     *      For gas, the user submits it directly.
     *      Signature is verified to ensure authenticity of the request.
     * 
     * @param _request The EIP2612 payment request.
     * @param _signature The signature to verify the request.
     * @param _requestType Type of request (1 = gasless, 2 = direct/gas)
     */
    function payWithPermit(
        ICore.EIP2612Request calldata _request,
        bytes calldata _signature,
        uint8 _requestType
    ) external whenNotPaused nonReentrant {
        if(_requestType == 1) {
            require(!blacklistRegistry[_request.signer], "user is blacklisted");
            require(relayerRegistry[_recoverSignerFromEIP2612Request(_request, _signature)], "invalid signature");
            _payWithPermit(_request, _request.signer);
        } else if(_requestType == 2) {
            require(!blacklistRegistry[msg.sender], "user is blacklisted");
            require(_recoverSignerFromEIP2612Request(_request, _signature) == msg.sender, "invalid signature");
            require(_request.signer == msg.sender, "eip-2612 signer must equals to msg.sender");
            _payWithPermit(_request, msg.sender);
        } else revert("invalid request type");
    }

    /**
     * @notice Executes a token payment using Uniswap's Permit2 permit-based authorization.
     * @dev Supports both gasless (relayer-submitted) and gas (user-submitted) requests.
     *      For gasless, the relayer submits the transaction on behalf of the user.
     *      For gas, the user submits it directly.
     *      Signature is verified to ensure authenticity of the request.
     * 
     * @param _request The Permit2 payment request.
     * @param _signature The signature to verify the request.
     * @param _requestType Type of request (1 = gasless, 2 = direct/gas)
     */
    function payWithPermit2(
        ICore.Permit2Request calldata _request,
        bytes calldata _signature,
        uint8 _requestType
    ) external whenNotPaused nonReentrant {
        if(_requestType == 1) {
            require(!blacklistRegistry[_request.signer], "user is blacklisted");
            require(relayerRegistry[_recoverSignerFromPermit2Request(_request, _signature)], "invalid signature");
            _payWithPermit2(_request, _request.signer);
        } else if(_requestType == 2) {
            require(!blacklistRegistry[msg.sender], "user is blacklisted");
            require(_recoverSignerFromPermit2Request(_request, _signature) == msg.sender, "invalid signature");
            require(_request.signer == msg.sender, "permit2 signer must equals to msg.sender");
            _payWithPermit2(_request, msg.sender);
        } else revert("invalid request type");
    }

    /**
     * @notice Refunds the transaction amount if the off-chain service fails or becomes unavailable.
     * @dev Only callable by the relayer. Ensures users are refunded when service delivery is unsuccessful.
     *      Emits a `ICore.Refunded` event.
     *
     * @param _user The address of the user who is receiving the refund.
     * @param _transactionId The unique off-chain transaction identifier associated with the failed payment.
     */
    function refund (address _user, bytes32 _transactionId) external whenNotPaused nonReentrant onlyRelayer {
        bytes32 transactionId = _namespaceTx(_transactionId, _user);
        ICore.Transaction memory transaction = transactionRegistry[_user][transactionId];
        require(transactionRegistry[_user][transactionId].exists, "transaction not exists");
        require(!transaction.refunded, "transaction has been refunded");
        require(_user == transaction.from, "user must equals to transaction.from");
        require(IERC20(transaction.token).balanceOf(recipient) >= transaction.receivedAmount, "not enough balance");        
        require(IERC20(transaction.token).allowance(recipient, address(this)) >= transaction.receivedAmount, "not enough allowance");
        uint256 beforeBalance = IERC20(transaction.token).balanceOf(transaction.from);
        // set refunded and transfer from recipient to the transaction sender using low-level assembly.
        transactionRegistry[transaction.from][transactionId].refunded = true;
        _safeTransferFrom(IERC20(transaction.token), recipient, transaction.from, transaction.receivedAmount);
        uint256 afterBalance = IERC20(transaction.token).balanceOf(transaction.from);
        uint256 receivedAmount = afterBalance - beforeBalance;
        volumeRegistry[transaction.token] -= transaction.receivedAmount;
        emit ICore.Refunded(transaction.from, transaction.token, receivedAmount, transactionId);
    }

    /**
     * @notice Retrieves the list of supported tokens.
     * @dev Returns the array of tokens that are currently stored in the contract.
     * @return An array of `ICore.Token` structs representing the supported tokens.
     */
    function getTokens() external view returns (ICore.Token[] memory) {
        return tokens;
    }

    /**
     * @notice Retrieves the list of authorized relayers.
     * @dev Returns the array of relayer addresses that are authorized within this contract.
     * @return An array of `address` values representing the authorized relayers.
     */
    function getRelayers() external view returns (address[] memory) {
        return relayers;
    }

    /**
     * @notice Pauses all contract operations that are sensitive to state changes.
     * @dev Only callable by the contract owner. Useful in case of emergencies.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resumes contract operations after being paused.
     * @dev Only callable by the contract owner.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Adds a new relayer to the list of relayers.
     * @dev Only callable by the contract owner. Internally calls `_addRelayer`.
     *
     * @param _relayer The relayer address to add.
     */
    function addRelayer(address _relayer) external onlyOwner {
        _addRelayer(_relayer);
    }

    /**
     * @notice Removes a relayer from the list of relayers.
     * @dev Only callable by the contract owner. Emits a `RelayerRemoved` event.
     *      Reverts if the relayer does not exists.
     *
     * @param _relayer The address of the relayer to remove.
     */
    function removeRelayer(address _relayer) external onlyOwner {
        require(_relayer != address(0), "relayer cannot be address zero");
        require(relayerRegistry[_relayer], "relayer not exists");
        relayerRegistry[_relayer] = false;
        for (uint256 i = 0; i < relayers.length; i++) {
            if (relayers[i] == _relayer) {
                relayers[i] = relayers[relayers.length - 1];
                relayers.pop();
                emit ICore.RelayerRemoved(_relayer);
                break;
            }
        }
    }

    /**
     * @notice Updates the recipient address.
     * @dev Only callable by the contract owner.
     *
     * @param _newRecipient The address of the new recipient.
     */
    function setRecipient(address _newRecipient) external onlyOwner {
        require(_newRecipient != address(0), "new recipient cannot be address zero");
        address oldRecipient = recipient;
        recipient = _newRecipient;
        emit ICore.RecipientTransferred(oldRecipient, _newRecipient);
    }

    /**
     * @notice Adds multiple addresses to the blacklist, preventing them from interacting with restricted functions.
     * @dev Only callable by the contract owner. Emits a `Blacklisted` event for each address.
     *
     * @param _users An array of addresses to be blacklisted.
     */
    function blacklist(address[] calldata _users) external onlyOwner {
        for (uint256 i = 0; i < _users.length; i++) {
            address user = _users[i];
            if (!blacklistRegistry[user]) {
                blacklistRegistry[user] = true;
                emit ICore.Blacklisted(user);
            }
        }
    }

    /**
     * @notice Removes an address from the blacklist, restoring its access to restricted functions.
     * @dev Only callable by the contract owner. Emits an `UnBlacklisted` event.
     *
     * @param _user The address to be removed from the blacklist.
     */
    function unBlacklist(address _user) external onlyOwner {
        blacklistRegistry[_user] = false;
        emit ICore.UnBlacklisted(_user);
    }

    /**
     * @notice Adds a new token to the list of accepted tokens.
     * @dev Only callable by the contract owner. Internally calls `_addToken`.
     *
     * @param _token The ERC20 token to add.
     */
    function addToken(ICore.Token memory _token) external onlyOwner {
        _addToken(_token);
    }

    /**
     * @notice Removes a token from the list of supported tokens.
     * @dev Only callable by the contract owner. Emits a `TokenRemoved` event.
     *      Reverts if the token is not currently supported.
     *
     * @param _token The address of the ERC20 token to remove.
     */
    function removeToken(address _token) external onlyOwner {
        require(_token != address(0), "token cannot be address zero");
        require(tokenRegistry[_token].supported, "token not supported");
        tokenRegistry[_token].supported = false;
        tokenRegistry[_token].minAmount = 0;
        tokenRegistry[_token].maxAmount = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i].token == _token) {
                tokens[i] = tokens[tokens.length - 1];
                tokens.pop();
                emit ICore.TokenRemoved(_token);
                break;
            }
        }
    }

    /**
     * @notice Updates the minimum and maximum allowed transfer amounts for supported tokens.
     * @dev Iterates over the provided token list and updates limits for tokens that are already marked as supported.
     *      Emits a `TokenUpdated` event.
     * 
     * @param _tokens An array of Token structs containing token address, minAmount, and maxAmount.
     */
    function updateToken(ICore.Token[] calldata _tokens) external onlyOwner {
        for (uint256 i = 0; i < _tokens.length; i++) {
            ICore.Token memory _token = _tokens[i];
            if(tokenRegistry[_token.token].supported) {
                require(_token.minAmount != 0, "minAmount cannot be 0");
                require(_token.maxAmount != 0, "maxAmount cannot be 0");
                require(_token.minAmount <= _token.maxAmount, "minAmount cannot be greater than maxAmount");
                tokenRegistry[_token.token].minAmount = _token.minAmount;
                tokenRegistry[_token.token].maxAmount = _token.maxAmount;
                emit ICore.TokenUpdated(_token.token);
            }
        }
    }

    /**
     * @notice Internal function to add a relayer to the relayers list.
     * @dev Reverts if the relayer is already added. Emits a `RelayerAdded` event.
     *
     * @param _relayer The relayer address to add.
     */
    function _addRelayer(address _relayer) internal {
        require(_relayer != address(0), "relayer cannot be address zero");
        require(!relayerRegistry[_relayer], "relayer already added");
        relayerRegistry[_relayer] = true;
        relayers.push(_relayer);
        emit ICore.RelayerAdded(_relayer);
    }

    /**
     * @notice Internal function to add a token to the supported list.
     * @dev Reverts if the token is already supported. Emits a `TokenAdded` event.
     *
     * @param _token The ERC20 token to add.
     */
    function _addToken(ICore.Token memory _token) internal {
        require(_token.token != address(0), "token cannot be address zero");
        require(!tokenRegistry[_token.token].supported, "token already supported");
        tokenRegistry[_token.token].token = _token.token;
        tokenRegistry[_token.token].minAmount = _token.minAmount;
        tokenRegistry[_token.token].maxAmount = _token.maxAmount;
        tokenRegistry[_token.token].supported = true;
        tokens.push(_token);
        emit ICore.TokenAdded(_token.token);
    }

    /**
     * @notice Generates a namespaced transaction ID unique to this signer, contract and chain.
     * @dev Hashes the original `_transactionId` together with the signer, current contract address
     *      and the blockchain's `chainid` to prevent replay across chains or contracts.
     *
     * @param _transactionId The original transaction ID (e.g., off-chain or external identifier).
     * @param _signer The signer authorized this transaction.
     * @return A namespaced `bytes32` hash scoped to this contract and chain.
     */
    function _namespaceTx(bytes32 _transactionId, address _signer) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(_transactionId, _signer, address(this), block.chainid));
    }

    /**
     * @notice Safely attempts to perform an ERC20 permit operation.
     * @dev First tries to call `permit()` to set the allowance via signature.
     *      If it fails (e.g., due to front-running), it checks if the allowance is already sufficient.
     *      Reverts only if both permit and allowance fallback fail.
     *      See TrustlessPermit: https://github.com/trust1995/trustlessPermit
     *      See Note: https://www.trust-security.xyz/post/permission-denied
     * 
     * @param token The ERC20 token implementing the permit function.
     * @param owner The address granting the allowance.
     * @param spender The address receiving the allowance.
     * @param value The amount to approve.
     * @param deadline The expiration time for the permit.
     * @param v Component of the permit signature.
     * @param r Component of the permit signature.
     * @param s Component of the permit signature.
     */
    function _safePermit(
        address token,
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        // try permit before allowance check to advance nonce if possible
        try IERC20Permit(token).permit(owner, spender, value, deadline, v, r, s) {
            return;
        } catch {
            // permit potentially got front-ran. continue anyways if allowance is sufficient.
            if (IERC20(token).allowance(owner, spender) >= value) {
                return;
            }
        }
        revert("permit failed");
    }

    /**
     * @notice Safely attempts to perform a Permit2 signature-based approval.
     * @dev First tries to call `permit2.permit()` to set the allowance via signature.
     *      If it fails (e.g., due to front-running), it checks if the allowance is already sufficient.
     *      Reverts only if both permit and allowance fallback fail.
     *      See openzeppelin-contracts Audit Note: https://blog.openzeppelin-contracts.com/uniswap-v4-periphery-and-universal-router-audit#permit2-signatures-could-be-front-run-to-temporarily-prevent-execution
     *
     * @param _permit The Permit2 permit structure containing token, spender, amount, expiration, and nonce.
     * @param _transferDetails Transfer details containing the requested amount.
     * @param _signer The address that signed the Permit2 permit.
     * @param _signature The Permit2-compliant signature from the signer.
     */
    function _safePermit2(
        IPermit2.PermitSingle calldata _permit,
        ICore.TransferDetails calldata _transferDetails,
        address _signer,
        bytes calldata _signature
    ) internal {
        // try permit2 before allowance check to advance nonce if possible
        try permit2.permit(_signer, _permit, _signature) {
            return;
        } catch {
            // permit2 potentially got front-ran. continue anyways if allowance is sufficient.
            (uint160 amount,,) = permit2.allowance(_signer, _permit.details.token, _permit.spender);
            if(amount >= _transferDetails.requestedAmount) {
                return;
            }
        }
        revert("permit2 failed");
    }

    /**
     * @notice Safely performs an ERC-20 `transferFrom` call using low-level assembly.
     * @dev Handles non-compliant ERC-20 tokens that do not return a boolean or return malformed data.
     *      Constructs the calldata manually and uses a low-level `call` for gas efficiency.
     *      This method ensures compatibility with a wide range of ERC-20 tokens (including broken ones like USDT).
     *      See Solmate's SafeTransferLib: https://github.com/transmissions11/solmate/blob/89365b880c4f3c786bdd453d4b8e8fe410344a69/src/utils/SafeTransferLib.sol#L30
     * 
     * @param _token  The ERC-20 token to transfer.
     * @param _from   The address to transfer tokens from.
     * @param _to     The recipient of the tokens.
     * @param _amount The amount of tokens to transfer.
     */
    function _safeTransferFrom(
        IERC20 _token,
        address _from,
        address _to,
        uint256 _amount
    ) internal {
        bool success;
        assembly ("memory-safe") {
            // get a pointer to some free memory.
            let freeMemoryPointer := mload(0x40)
            // write the abi-encoded calldata into memory, beginning with the function selector.
            mstore(freeMemoryPointer, 0x23b872dd00000000000000000000000000000000000000000000000000000000)
            mstore(add(freeMemoryPointer, 4), and(_from, 0xffffffffffffffffffffffffffffffffffffffff)) // append and mask the "_from" argument.
            mstore(add(freeMemoryPointer, 36), and(_to, 0xffffffffffffffffffffffffffffffffffffffff)) // append and mask the "_to" argument.
            mstore(add(freeMemoryPointer, 68), _amount) // append the "_amount" argument. Masking not required as it's a full 32 byte type.
            // we use 100 because the length of our calldata totals up like so: 4 + 32 * 3.
            // we use 0 and 32 to copy up to 32 bytes of return data into the scratch space.
            success := call(gas(), _token, 0, freeMemoryPointer, 100, 0, 32)
            // set success to whether the call reverted, if not we check it either
            // returned exactly 1 (cannot just be non-zero data), or had no return data and token has code.
            if and(iszero(and(eq(mload(0), 1), gt(returndatasize(), 31))), success) {
                success := iszero(or(iszero(extcodesize(_token)), returndatasize())) 
            }
        }
        require(success, "transfer from failed");
    }

    /**
     * @notice Executes a token payment using EIP-2612 permit-based authorization.
     * @dev Transfers tokens from the signer using an off-chain signature without requiring prior on-chain approval.
     *      Emits a `ICore.Paid` event. See EIP-2612: https://eips.ethereum.org/EIPS/eip-2612
     * 
     * @param _request The EIP2612 payment request.
     * @param _signer The user authorizing the token transfer via signature.
     */
    function _payWithPermit(
        ICore.EIP2612Request calldata _request,
        address _signer
    ) internal {
        bytes32 transactionId = _namespaceTx(_request.transactionId, _signer);
        require(!transactionRegistry[_signer][transactionId].exists, "transaction already exists");
        require(tokenRegistry[_request.permit.permitted.token].supported, "token not supported");
        require(_request.transferDetails.requestedAmount >= tokenRegistry[_request.permit.permitted.token].minAmount && _request.transferDetails.requestedAmount <= tokenRegistry[_request.permit.permitted.token].maxAmount, "min and max amount out of bound");
        require(_request.permit.permitted.value == _request.transferDetails.requestedAmount, "permitted.value must equals to requestedAmount");
        require(_request.permit.permitted.spender == address(this), "permitted.spender must equals to address(this)");
        require(_request.transferDetails.to == recipient, "transferDetails.to must equals to recipient");
        require(_signer != recipient, "signer cannot be recipient");
        uint256 beforeBalance = IERC20(_request.permit.permitted.token).balanceOf(_request.transferDetails.to);
        // permit and transfer token from signer using low-level assembly.
        _safePermit(_request.permit.permitted.token, _signer, _request.permit.permitted.spender, _request.permit.permitted.value, _request.permit.permitted.deadline, _request.permit.signature.v, _request.permit.signature.r, _request.permit.signature.s);
        _safeTransferFrom(IERC20(_request.permit.permitted.token), _signer, _request.transferDetails.to, _request.transferDetails.requestedAmount);
        uint256 afterBalance = IERC20(_request.permit.permitted.token).balanceOf(_request.transferDetails.to);
        uint256 receivedAmount = afterBalance - beforeBalance;
        transactionRegistry[_signer][transactionId] = ICore.Transaction(transactionId, _signer, _request.permit.permitted.token, _request.transferDetails.requestedAmount, receivedAmount, true, false);
        volumeRegistry[_request.permit.permitted.token] += receivedAmount;
        emit ICore.Paid(_signer, _request.permit.permitted.token, receivedAmount, transactionId);
    }

    /**
     * @notice Executes a token payment using Uniswap's Permit2 system.
     * @dev Transfers tokens from the signer based on a signed Permit2 authorization without requiring prior approval.
     *      Emits a `ICore.Paid` event. See Permit2: https://github.com/Uniswap/permit2
     * 
     * @param _request The Permit2 payment request.
     * @param _signer The user authorizing the token transfer via signature.
     */
    function _payWithPermit2(
        ICore.Permit2Request calldata _request,
        address _signer
    ) internal {
        bytes32 transactionId = _namespaceTx(_request.transactionId, _signer);
        require(!transactionRegistry[_signer][transactionId].exists, "transaction already exists");
        require(tokenRegistry[_request.permit.details.token].supported, "token not supported");
        require(_request.transferDetails.requestedAmount >= tokenRegistry[_request.permit.details.token].minAmount && _request.transferDetails.requestedAmount <= tokenRegistry[_request.permit.details.token].maxAmount, "min and max amount out of bound");
        require(_request.permit.details.amount == _request.transferDetails.requestedAmount, "details.amount must equals to requestedAmount");
        require(_request.permit.spender == address(this), "permit.spender must equals to address(this)");
        require(_request.transferDetails.to == recipient, "transferDetails.to must equals recipient");
        require(_signer != recipient, "signer cannot be recipient");
        uint256 beforeBalance = IERC20(_request.permit.details.token).balanceOf(_request.transferDetails.to);
        // permit and transfer token from signer.
        _safePermit2(_request.permit, _request.transferDetails, _signer, _request.signature);
        permit2.transferFrom(_signer, _request.transferDetails.to, _request.transferDetails.requestedAmount, _request.permit.details.token);
        uint256 afterBalance = IERC20(_request.permit.details.token).balanceOf(_request.transferDetails.to);
        uint256 receivedAmount = afterBalance - beforeBalance;
        transactionRegistry[_signer][transactionId] = ICore.Transaction(transactionId, _signer, _request.permit.details.token, _request.transferDetails.requestedAmount, receivedAmount, true, false);
        volumeRegistry[_request.permit.details.token] += receivedAmount;
        emit ICore.Paid(_signer, _request.permit.details.token, receivedAmount, transactionId);
    }
}