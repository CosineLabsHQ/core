// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../../lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "../../lib/openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title MockERC20Permit
 * @notice Simulate ERC20 token with EIP-2612 permit functionality.
 * @dev Internal testing utility contract for simulating ERC20 token with EIP-2612 permit functionality.
 * 
 * @custom:company Cosine Labs Inc.
 * @custom:contact engineering@getcosine.app
 * @custom:url https://getcosine.app
 * @notice Copyright (c) 2025 Cosine Labs Inc.
 * @custom:license MIT
 */
contract MockERC20Permit is ERC20, ERC20Permit {
    uint8 private _decimals;

    /**
     * @notice Deploys the mock MockERC20Permit token with a specified name, symbol, and decimals.
     * @dev Also initializes the EIP-2612 permit domain separator via ERC20Permit.
     * 
     * @param name The name of the token (e.g., "Token1").
     * @param symbol The token ticker symbol (e.g., "TK1").
     * @param decimals_ The number of decimal places for the token.
     */
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) ERC20Permit(name) {
        _decimals = decimals_;
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
     * @notice Burns `amount` tokens from the `from` address.
     * @dev Caller must have the appropriate permissions to burn tokens from the specified address.
     * 
     * @param from The address whose tokens will be burned.
     * @param amount The number of tokens to burn (in smallest unit, according to decimals()).
     */
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}