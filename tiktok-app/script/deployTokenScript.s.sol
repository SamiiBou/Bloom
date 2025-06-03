// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/token.sol";

contract DeployUmaniToken is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        
        console.log("=== DEBUT DU DEPLOIEMENT ===");
        console.log("Deployer address:", deployerAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Déploiement du contrat
        console.log("Deploiement du contrat en cours...");
        UmaniToken umaniToken = new UmaniToken(deployerAddress);
        
        // Logs immédiatement après déploiement
        console.log("=== VERIFICATION POST-DEPLOIEMENT ===");
        console.log("UmaniToken deployed at:", address(umaniToken));
        console.log("Token name():", umaniToken.name());
        console.log("Token symbol():", umaniToken.symbol());
        console.log("Token decimals():", umaniToken.decimals());
        console.log("Token totalSupply():", umaniToken.totalSupply());
        console.log("Owner:", umaniToken.owner());
        
        // Utilisation de la fonction debug
        (string memory debugName, string memory debugSymbol) = umaniToken.debugTokenInfo();
        console.log("=== DEBUG INFO ===");
        console.log("Debug name:", debugName);
        console.log("Debug symbol:", debugSymbol);
        
        // Set the metadata URI after deployment
        console.log("Setting token URI...");
        umaniToken.setTokenURI("ipfs://bafkreidgqonfwdicpbe2rxfkejumxo33s6wl63bq6qigjdgc4xlvctcsfi");
        console.log("Token URI set to:", umaniToken.tokenURI());
        
        vm.stopBroadcast();
        
        console.log("=== DEPLOIEMENT TERMINE ===");
        console.log("Adresse finale du contrat:", address(umaniToken));
        console.log("Nom final:", umaniToken.name());
        console.log("Symbole final:", umaniToken.symbol());
    }
}