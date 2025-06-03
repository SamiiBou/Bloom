// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/BloomStaking.sol";

contract DeployBloomStaking is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        
        // IMPORTANT : Remplacez cette adresse par l'adresse de votre token BLOOM déployé
        address bloomTokenAddress = 0x8b2D045381c7B9E09dC72fc3DDEbC1c74724E78D; // ⚠️ À MODIFIER

        console.log("=== DEBUT DU DEPLOIEMENT STAKING ===");
        console.log("Deployer address:", deployerAddress);
        console.log("BLOOM Token address:", bloomTokenAddress);

        vm.startBroadcast(deployerPrivateKey);
        
        // 1) Envoi « dummy » de 0 ETH à soi-même pour consommer la nonce = 0
        //    Après cette ligne, la nonce de l'EOA passera à 1.
        (bool sent, ) = payable(deployerAddress).call{ value: 0 }("");
        require(sent, "Bump nonce failed");

        // 2) Déploiement du contrat de staking : cette tx utilisera désormais nonce = 1 
        // console.log("Déploiement du contrat de staking en cours...");
        BloomStaking stakingContract = new BloomStaking(bloomTokenAddress, deployerAddress);
        
        // Logs après déploiement
        console.log("=== VERIFICATION POST-DEPLOIEMENT ===");
        console.log("BloomStaking deployed at:", address(stakingContract));
        console.log("BLOOM Token:", address(stakingContract.bloomToken()));
        console.log("Owner:", stakingContract.owner());
        console.log("Reward Rate:", stakingContract.rewardRate(), "%");
        console.log("Minimum Stake Amount:", stakingContract.minimumStakeAmount());
        console.log("Staking Duration:", stakingContract.stakingDuration(), "seconds");
        
        vm.stopBroadcast();

        console.log("=== DEPLOIEMENT TERMINE ===");
        console.log("Adresse finale du contrat de staking:", address(stakingContract));
        console.log("N'oubliez pas de :");
        console.log("2. Ajouter l'adresse du contrat dans votre front-end");
        console.log("3. Configurer les adresses dans World App Developer Portal");
    }
}
