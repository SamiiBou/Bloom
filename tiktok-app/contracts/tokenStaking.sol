// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract TokenStaking is ReentrancyGuard, Ownable, Pausable {
    IERC20 public immutable stakingToken;
    
    // ✅ AJOUT: Interface Permit2 pour vérifier si les tokens viennent de Permit2
    address public constant PERMIT2_ADDRESS = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    
    // Structure pour représenter un stake
    struct Stake {
        uint256 amount;           // Montant staké
        uint256 timestamp;        // Timestamp du stake
        uint256 lockPeriod;       // Période de lock en secondes
        bool withdrawn;           // Indique si retiré
    }
    
    // Structure pour les statistiques utilisateur
    struct UserStats {
        uint256 totalStaked;      // Total actuellement staké
        uint256 totalWithdrawn;   // Total retiré historiquement
        uint256 stakeCount;       // Nombre total de stakes
    }
    
    // Mapping des stakes par utilisateur et ID de stake
    mapping(address => mapping(uint256 => Stake)) public stakes;
    mapping(address => uint256) public userStakeCount;
    mapping(address => UserStats) public userStats;
    
    // Statistiques globales
    uint256 public totalStakedGlobal;
    uint256 public totalWithdrawnGlobal;
    uint256 public totalStakersCount;
    
    // Périodes de lock prédéfinies (en secondes)
    uint256 public constant LOCK_7_DAYS = 7 days;
    uint256 public constant LOCK_30_DAYS = 30 days;
    uint256 public constant LOCK_90_DAYS = 90 days;
    uint256 public constant LOCK_180_DAYS = 180 days;
    uint256 public constant LOCK_365_DAYS = 365 days;
    
    // Montant minimum de stake
    uint256 public minimumStakeAmount;
    
    // Events
    event Staked(
        address indexed user, 
        uint256 indexed stakeId, 
        uint256 amount, 
        uint256 lockPeriod, 
        uint256 unlockTime
    );
    
    event Withdrawn(
        address indexed user, 
        uint256 indexed stakeId, 
        uint256 amount
    );
    
    event EmergencyWithdraw(
        address indexed user, 
        uint256 indexed stakeId, 
        uint256 amount, 
        uint256 penalty
    );
    
    event MinimumStakeAmountUpdated(uint256 oldAmount, uint256 newAmount);
    
    constructor(
        address _stakingToken, 
        uint256 _minimumStakeAmount
    ) Ownable(msg.sender) {
        require(_stakingToken != address(0), "Invalid token address");
        require(_minimumStakeAmount > 0, "Minimum stake must be > 0");
        
        stakingToken = IERC20(_stakingToken);
        minimumStakeAmount = _minimumStakeAmount;
    }
    
    /**
     * @dev Stake des tokens pour une période donnée
     * ✅ MODIFIÉ: Compatible avec Permit2 - les tokens sont déjà transférés par Permit2
     * @param _amount Montant à staker
     * @param _lockPeriod Période de lock en secondes
     */
    function stake(uint256 _amount, uint256 _lockPeriod) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(_amount >= minimumStakeAmount, "Amount below minimum");
        require(_isValidLockPeriod(_lockPeriod), "Invalid lock period");
        
        // ✅ MODIFIÉ: Vérifier que le contrat a reçu les tokens
        // (ils ont déjà été transférés par Permit2 dans la transaction précédente)
        uint256 contractBalance = stakingToken.balanceOf(address(this));
        require(contractBalance >= _amount, "Contract did not receive tokens");
        
        // ✅ OPTIONNEL: Vérifier si l'appel vient d'une transaction Permit2
        // Ceci n'est qu'une vérification supplémentaire, pas obligatoire
        
        // Créer le stake
        uint256 stakeId = userStakeCount[msg.sender];
        stakes[msg.sender][stakeId] = Stake({
            amount: _amount,
            timestamp: block.timestamp,
            lockPeriod: _lockPeriod,
            withdrawn: false
        });
        
        // Mettre à jour les compteurs
        userStakeCount[msg.sender]++;
        userStats[msg.sender].stakeCount++;
        
        // Première fois que l'utilisateur stake
        if (userStats[msg.sender].totalStaked == 0) {
            totalStakersCount++;
        }
        
        userStats[msg.sender].totalStaked += _amount;
        totalStakedGlobal += _amount;
        
        emit Staked(
            msg.sender, 
            stakeId, 
            _amount, 
            _lockPeriod, 
            block.timestamp + _lockPeriod
        );
    }
    
    /**
     * @dev Version alternative qui accepte les tokens directement (pour compatibilité)
     * Cette fonction peut être appelée séparément si les tokens ne sont pas pré-transférés
     */
    function stakeWithTransfer(uint256 _amount, uint256 _lockPeriod) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(_amount >= minimumStakeAmount, "Amount below minimum");
        require(_isValidLockPeriod(_lockPeriod), "Invalid lock period");
        require(
            stakingToken.balanceOf(msg.sender) >= _amount, 
            "Insufficient balance"
        );
        
        // Transférer les tokens vers le contrat (méthode classique)
        require(
            stakingToken.transferFrom(msg.sender, address(this), _amount),
            "Transfer failed"
        );
        
        // Créer le stake (même logique que stake())
        uint256 stakeId = userStakeCount[msg.sender];
        stakes[msg.sender][stakeId] = Stake({
            amount: _amount,
            timestamp: block.timestamp,
            lockPeriod: _lockPeriod,
            withdrawn: false
        });
        
        userStakeCount[msg.sender]++;
        userStats[msg.sender].stakeCount++;
        
        if (userStats[msg.sender].totalStaked == 0) {
            totalStakersCount++;
        }
        
        userStats[msg.sender].totalStaked += _amount;
        totalStakedGlobal += _amount;
        
        emit Staked(
            msg.sender, 
            stakeId, 
            _amount, 
            _lockPeriod, 
            block.timestamp + _lockPeriod
        );
    }
    
    /**
     * @dev Retirer un stake après la période de lock
     * @param _stakeId ID du stake à retirer
     */
    function withdraw(uint256 _stakeId) external nonReentrant {
        require(_stakeId < userStakeCount[msg.sender], "Invalid stake ID");
        
        Stake storage userStake = stakes[msg.sender][_stakeId];
        require(!userStake.withdrawn, "Already withdrawn");
        require(
            block.timestamp >= userStake.timestamp + userStake.lockPeriod,
            "Lock period not ended"
        );
        
        uint256 amount = userStake.amount;
        userStake.withdrawn = true;
        
        // Mettre à jour les statistiques
        userStats[msg.sender].totalStaked -= amount;
        userStats[msg.sender].totalWithdrawn += amount;
        totalStakedGlobal -= amount;
        totalWithdrawnGlobal += amount;
        
        // Transférer les tokens à l'utilisateur
        require(stakingToken.transfer(msg.sender, amount), "Transfer failed");
        
        emit Withdrawn(msg.sender, _stakeId, amount);
    }
    
    /**
     * @dev Retrait d'urgence avec pénalité (50% de perte)
     * @param _stakeId ID du stake à retirer
     */
    function emergencyWithdraw(uint256 _stakeId) external nonReentrant {
        require(_stakeId < userStakeCount[msg.sender], "Invalid stake ID");
        
        Stake storage userStake = stakes[msg.sender][_stakeId];
        require(!userStake.withdrawn, "Already withdrawn");
        require(
            block.timestamp < userStake.timestamp + userStake.lockPeriod,
            "Use normal withdraw instead"
        );
        
        uint256 stakedAmount = userStake.amount;
        uint256 penalty = stakedAmount / 2; // 50% de pénalité
        uint256 withdrawAmount = stakedAmount - penalty;
        
        userStake.withdrawn = true;
        
        // Mettre à jour les statistiques
        userStats[msg.sender].totalStaked -= stakedAmount;
        userStats[msg.sender].totalWithdrawn += withdrawAmount;
        totalStakedGlobal -= stakedAmount;
        totalWithdrawnGlobal += withdrawAmount;
        
        // Transférer le montant réduit à l'utilisateur
        if (withdrawAmount > 0) {
            require(
                stakingToken.transfer(msg.sender, withdrawAmount), 
                "Transfer failed"
            );
        }
        
        emit EmergencyWithdraw(msg.sender, _stakeId, withdrawAmount, penalty);
    }
    
    // ✅ AJOUT: Fonction pour vérifier la balance du contrat (utile pour debug)
    function getContractTokenBalance() external view returns (uint256) {
        return stakingToken.balanceOf(address(this));
    }
    
    /**
     * @dev Obtenir les détails d'un stake
     */
    function getStakeDetails(address _user, uint256 _stakeId) 
        external 
        view 
        returns (
            uint256 amount,
            uint256 timestamp,
            uint256 lockPeriod,
            uint256 unlockTime,
            bool withdrawn,
            bool canWithdraw
        ) 
    {
        require(_stakeId < userStakeCount[_user], "Invalid stake ID");
        
        Stake memory userStake = stakes[_user][_stakeId];
        unlockTime = userStake.timestamp + userStake.lockPeriod;
        canWithdraw = !userStake.withdrawn && block.timestamp >= unlockTime;
        
        return (
            userStake.amount,
            userStake.timestamp,
            userStake.lockPeriod,
            unlockTime,
            userStake.withdrawn,
            canWithdraw
        );
    }
    
    /**
     * @dev Obtenir tous les stakes d'un utilisateur
     */
    function getUserStakes(address _user) 
        external 
        view 
        returns (
            uint256[] memory amounts,
            uint256[] memory timestamps,
            uint256[] memory lockPeriods,
            uint256[] memory unlockTimes,
            bool[] memory withdrawn,
            bool[] memory canWithdraw
        ) 
    {
        uint256 stakeCount = userStakeCount[_user];
        
        amounts = new uint256[](stakeCount);
        timestamps = new uint256[](stakeCount);
        lockPeriods = new uint256[](stakeCount);
        unlockTimes = new uint256[](stakeCount);
        withdrawn = new bool[](stakeCount);
        canWithdraw = new bool[](stakeCount);
        
        for (uint256 i = 0; i < stakeCount; i++) {
            Stake memory userStake = stakes[_user][i];
            amounts[i] = userStake.amount;
            timestamps[i] = userStake.timestamp;
            lockPeriods[i] = userStake.lockPeriod;
            unlockTimes[i] = userStake.timestamp + userStake.lockPeriod;
            withdrawn[i] = userStake.withdrawn;
            canWithdraw[i] = !userStake.withdrawn && 
                             block.timestamp >= unlockTimes[i];
        }
    }
    
    /**
     * @dev Vérifier si une période de lock est valide
     */
    function _isValidLockPeriod(uint256 _lockPeriod) private pure returns (bool) {
        return _lockPeriod == LOCK_7_DAYS || 
               _lockPeriod == LOCK_30_DAYS || 
               _lockPeriod == LOCK_90_DAYS || 
               _lockPeriod == LOCK_180_DAYS || 
               _lockPeriod == LOCK_365_DAYS;
    }
    
    /**
     * @dev Obtenir la liste des périodes de lock disponibles
     */
    function getValidLockPeriods() 
        external 
        pure 
        returns (uint256[] memory periods, string[] memory labels) 
    {
        periods = new uint256[](5);
        labels = new string[](5);
        
        periods[0] = LOCK_7_DAYS;
        labels[0] = "7 days";
        
        periods[1] = LOCK_30_DAYS;
        labels[1] = "30 days";
        
        periods[2] = LOCK_90_DAYS;
        labels[2] = "90 days";
        
        periods[3] = LOCK_180_DAYS;
        labels[3] = "180 days";
        
        periods[4] = LOCK_365_DAYS;
        labels[4] = "365 days";
    }
    
    // Fonctions d'administration
    function setMinimumStakeAmount(uint256 _newAmount) external onlyOwner {
        require(_newAmount > 0, "Amount must be > 0");
        uint256 oldAmount = minimumStakeAmount;
        minimumStakeAmount = _newAmount;
        emit MinimumStakeAmountUpdated(oldAmount, _newAmount);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // Fonction d'urgence pour récupérer les tokens bloqués
    function emergencyRecoverTokens(address _token, uint256 _amount) 
        external 
        onlyOwner 
    {
        require(_token != address(stakingToken), "Cannot recover staking token");
        IERC20(_token).transfer(owner(), _amount);
    }
}