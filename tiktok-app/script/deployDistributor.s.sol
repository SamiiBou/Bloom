pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import { Distributor } from "../contracts/distributor.sol";

contract DeployDistributor is Script {
    function run() external {
        // 1. Récupérer la clé privée depuis les env vars
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // 2. Démarrer la forge broadcast
        vm.startBroadcast(deployerPrivateKey);

        // 3. Déployer
        address tokenAddr     = vm.envAddress("TOKEN_CONTRACT_ADDRESS");
        address signerAddress = vm.envAddress("SIGNER_ADDRESS");
        Distributor dist = new Distributor(tokenAddr, signerAddress);

        // 4. Afficher l’adresse pour la verifier
        console.log("Distributor deployed at", address(dist));

        vm.stopBroadcast();
    }
}