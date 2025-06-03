// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BloomStaking is Ownable, ReentrancyGuard {
    IERC20 public immutable bloomToken;
    
    // Structure pour stocker les informations de staking d'un utilisateur
    struct StakeInfo {
        uint256 amount;           // Montant staké
        uint256 stakeTime;        // Timestamp du staking
        uint256 lastClaimTime;    // Dernier claim de récompenses
        bool isActive;            // Si le stake est actif
    }
    
    // Mapping des stakes par utilisateur
    mapping(address => StakeInfo[]) public userStakes;
    
    // Variables globales
    uint256 public totalStaked;
    uint256 public rewardRate = 10; // 10% APY par défaut
    uint256 public minimumStakeAmount = 1000 * 10**18; // 1000 BLOOM minimum
    uint256 public stakingDuration = 30 days; // Durée minimum de staking
    
    // Events
    event Staked(address indexed user, uint256 amount, uint256 stakeIndex);
    event Unstaked(address indexed user, uint256 amount, uint256 stakeIndex);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 newRate);
    
    constructor(address _bloomToken, address initialOwner) Ownable(initialOwner) {
        bloomToken = IERC20(_bloomToken);
    }
    
    /**
     * @dev Fonction pour staker des tokens BLOOM
     * @param amount Montant à staker
     */
    function stake(uint256 amount) external nonReentrant {
        require(amount >= minimumStakeAmount, "Amount below minimum stake");
        require(bloomToken.balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // Transfer tokens from user to contract
        require(bloomToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        // Créer un nouveau stake
        userStakes[msg.sender].push(StakeInfo({
            amount: amount,
            stakeTime: block.timestamp,
            lastClaimTime: block.timestamp,
            isActive: true
        }));
        
        totalStaked += amount;
        
        emit Staked(msg.sender, amount, userStakes[msg.sender].length - 1);
    }
    
    /**
     * @dev Fonction pour unstaker des tokens
     * @param stakeIndex Index du stake à retirer
     */
    function unstake(uint256 stakeIndex) external nonReentrant {
        require(stakeIndex < userStakes[msg.sender].length, "Invalid stake index");
        
        StakeInfo storage stakeInfo = userStakes[msg.sender][stakeIndex];
        require(stakeInfo.isActive, "Stake not active");
        require(block.timestamp >= stakeInfo.stakeTime + stakingDuration, "Staking duration not met");
        
        uint256 amount = stakeInfo.amount;
        
        // Calculer et transférer les récompenses
        uint256 rewards = calculateRewards(msg.sender, stakeIndex);
        if (rewards > 0) {
            require(bloomToken.transfer(msg.sender, rewards), "Reward transfer failed");
            emit RewardsClaimed(msg.sender, rewards);
        }
        
        // Retourner le principal
        require(bloomToken.transfer(msg.sender, amount), "Principal transfer failed");
        
        // Marquer le stake comme inactif
        stakeInfo.isActive = false;
        totalStaked -= amount;
        
        emit Unstaked(msg.sender, amount, stakeIndex);
    }
    
    /**
     * @dev Fonction pour claim les récompenses sans unstaker
     * @param stakeIndex Index du stake
     */
    function claimRewards(uint256 stakeIndex) external nonReentrant {
        require(stakeIndex < userStakes[msg.sender].length, "Invalid stake index");
        
        StakeInfo storage stakeInfo = userStakes[msg.sender][stakeIndex];
        require(stakeInfo.isActive, "Stake not active");
        
        uint256 rewards = calculateRewards(msg.sender, stakeIndex);
        require(rewards > 0, "No rewards available");
        
        stakeInfo.lastClaimTime = block.timestamp;
        
        require(bloomToken.transfer(msg.sender, rewards), "Reward transfer failed");
        
        emit RewardsClaimed(msg.sender, rewards);
    }
    
    /**
     * @dev Calculer les récompenses pour un stake donné
     * @param user Adresse de l'utilisateur
     * @param stakeIndex Index du stake
     */
    function calculateRewards(address user, uint256 stakeIndex) public view returns (uint256) {
        if (stakeIndex >= userStakes[user].length) return 0;
        
        StakeInfo memory stakeInfo = userStakes[user][stakeIndex];
        if (!stakeInfo.isActive) return 0;
        
        uint256 timeStaked = block.timestamp - stakeInfo.lastClaimTime;
        uint256 yearInSeconds = 365 days;
        
        // Calcul : (amount * rewardRate * timeStaked) / (100 * yearInSeconds)
        return (stakeInfo.amount * rewardRate * timeStaked) / (100 * yearInSeconds);
    }
    
    /**
     * @dev Obtenir tous les stakes d'un utilisateur
     * @param user Adresse de l'utilisateur
     */
    function getUserStakes(address user) external view returns (StakeInfo[] memory) {
        return userStakes[user];
    }
    
    /**
     * @dev Obtenir le nombre de stakes d'un utilisateur
     * @param user Adresse de l'utilisateur
     */
    function getUserStakeCount(address user) external view returns (uint256) {
        return userStakes[user].length;
    }
    
    /**
     * @dev Calculer le total des récompenses pending pour un utilisateur
     * @param user Adresse de l'utilisateur
     */
    function getTotalPendingRewards(address user) external view returns (uint256) {
        uint256 totalRewards = 0;
        StakeInfo[] memory stakes = userStakes[user];
        
        for (uint256 i = 0; i < stakes.length; i++) {
            if (stakes[i].isActive) {
                totalRewards += calculateRewards(user, i);
            }
        }
        
        return totalRewards;
    }
    
    /**
     * @dev Obtenir le total staké par un utilisateur
     * @param user Adresse de l'utilisateur
     */
    function getUserTotalStaked(address user) external view returns (uint256) {
        uint256 total = 0;
        StakeInfo[] memory stakes = userStakes[user];
        
        for (uint256 i = 0; i < stakes.length; i++) {
            if (stakes[i].isActive) {
                total += stakes[i].amount;
            }
        }
        
        return total;
    }
    
    // Fonctions d'administration
    function setRewardRate(uint256 _rewardRate) external onlyOwner {
        require(_rewardRate <= 100, "Reward rate too high"); // Max 100% APY
        rewardRate = _rewardRate;
        emit RewardRateUpdated(_rewardRate);
    }
    
    function setMinimumStakeAmount(uint256 _amount) external onlyOwner {
        minimumStakeAmount = _amount;
    }
    
    function setStakingDuration(uint256 _duration) external onlyOwner {
        stakingDuration = _duration;
    }
    
    // Fonction d'urgence pour retirer des tokens (owner seulement)
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(bloomToken.transfer(owner(), amount), "Emergency withdraw failed");
    }
}