// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../../lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "../../lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title MockERC20PermitWithFee
 * @notice Simulate ERC20 token with EIP-2612 permit and fee functionality.
 * @dev Internal testing utility contract for simulating ERC20 token with EIP-2612 permit and fee functionality.
 * 
 * @custom:company Cosine Labs Inc.
 * @custom:contact engineering@getcosine.app
 * @custom:url https://getcosine.app
 * @notice Copyright (c) 2025 Cosine Labs Inc.
 * @custom:license MIT
 */
contract MockERC20PermitWithFee is ERC20, ERC20Permit {
    uint8 private _decimals;
    uint256 public feeRate; // fee rate in basis points (100 = 1%)

    /**
     * @notice Deploys the MockERC20PermitWithFee token with a specified name, symbol, and decimals.
     * @dev Sets the token metadata (name, symbol, decimals) and initial fee rate.
     * 
     * @param name The name of the token (e.g., "Token1").
     * @param symbol The token ticker symbol (e.g., "TK1").
     * @param decimals_ The number of decimal places for the token.
     * @param feeRate_ Initial fee rate in basis points (e.g., 100 = 1%).
     */
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 feeRate_
    ) ERC20(name, symbol) ERC20Permit(name) {
        _decimals = decimals_;
        feeRate = feeRate_;
    }

    /**
     * @notice Returns the number of decimal places used to get its user representation.
     * @dev This information is only for display purposes; it does not affect how tokens are stored internally.
     * 
     * @return The number of decimal places for the token.
     */
    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Mints `amount` tokens to the `to` address.
     * @dev Caller must have the appropriate permissions to mint tokens.
     * 
     * @param to The address that will receive the newly minted tokens.
     * @param amount The number of tokens to mint (in smallest unit, according to decimals()).
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Updates the token's fee rate.
     * @dev Fee rate must not exceed 1000 basis points (10%).
     * 
     * @param newFeeRate The new fee rate in basis points.
     */
    function setFeeRate(uint256 newFeeRate) external {
        require(newFeeRate <= 1000, "fee rate too high"); 
        feeRate = newFeeRate;
    }
 
    /**
     * @notice Override transfers behaviour with fee deduction.
     * @dev Internal function to process transfers with fee deduction.
     *      A portion of the amount is burned as a fee before completing the transfer.
     * 
     * @param from Address sending the tokens.
     * @param to Address receiving the tokens.
     * @param amount Amount of tokens being transferred before fee deduction.
     */
    function _update(address from, address to, uint256 amount) internal virtual override {
        uint256 fee = (amount * feeRate) / 10000;
        uint256 transferAmount = amount - fee;
        super._update(from, to, transferAmount);
        if (fee > 0) {
            super._update(from, address(0), fee); // burn fee
        } 
    }
}