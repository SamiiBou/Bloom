// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract UmaniToken is ERC20, ERC20Burnable, Ownable, ERC20Permit {
    string private _tokenURI;
    uint256 public constant MAX_SUPPLY = 1_000_000_000_000 * 10**18; // 1000 billion tokens (1 trillion)

    // Événement pour logger les paramètres du constructeur
    event TokenCreated(string name, string symbol, address owner, uint256 initialSupply);

    constructor(address initialOwner)
        ERC20("BLOOM", "BLM")  // ⚠️ Vérifiez bien ces valeurs
        Ownable(initialOwner)
        ERC20Permit("BLOOM")   // ⚠️ J'ai enlevé l'espace en trop
    {
        // Log des paramètres avant mint
        emit TokenCreated("BLOOM", "BLM", initialOwner, 1_000_000_000_000 * 10**18);
        
        // Mint 1000 billion tokens to the initial owner (j'ai corrigé la syntaxe)
        _mint(initialOwner, 1_000_000_000_000 * 10**18);
    }

    /**
     * @dev Creates `amount` new tokens for `to`, increasing the total supply.
     * Can only be called by the owner, and total supply must not exceed MAX_SUPPLY.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds maximum token supply");
        _mint(to, amount);
    }

    /**
     * @dev Sets the metadata URI for this token (e.g., IPFS link to logo, metadata).
     */
    function setTokenURI(string memory newTokenURI) public onlyOwner {
        _tokenURI = newTokenURI;
    }

    /**
     * @dev Returns the metadata URI for this token.
     */
    function tokenURI() public view returns (string memory) {
        return _tokenURI;
    }

    // Fonction pour debugger - à supprimer en production
    function debugTokenInfo() public view returns (string memory, string memory) {
        return (name(), symbol());
    }
}