// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Script.sol";
import { TokenStaking } from "../contracts/TokenStaking.sol";

contract DeployTokenStaking is Script {
    function run() external {
        // 1. Récupérer la clé privée depuis les env vars
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // 2. Démarrer la forge broadcast
        vm.startBroadcast(deployerPrivateKey);
        
        // 3. Récupérer les adresses depuis les env vars
        address tokenAddr = vm.envAddress("TOKEN_CONTRACT_ADDRESS");
        
        // 4. Définir le montant minimum de stake
        uint256 minimumStakeAmount = 1e18; // 1 token minimum
        
        // 5. Utiliser un salt pour créer une adresse différente
        bytes32 salt = keccak256(abi.encodePacked("TokenStaking_v2", block.timestamp));
        
        // 6. Déployer avec CREATE2 pour une adresse déterministe mais unique
        TokenStaking staking = new TokenStaking{salt: salt}(tokenAddr, minimumStakeAmount);
        
        // 7. Afficher les informations
        console.log("TokenStaking deployed at:", address(staking));
        console.log("Staking token address:", tokenAddr);
        console.log("Minimum stake amount:", minimumStakeAmount);
        console.log("Salt used:", vm.toString(salt));
        
        // 8. Vérifier que le contrat fonctionne
        console.log("Staking token from contract:", address(staking.stakingToken()));
        console.log("Minimum stake from contract:", staking.minimumStakeAmount());
        
        vm.stopBroadcast();
    }
}