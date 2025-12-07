// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title DeferredPaymentEscrowUpgradeable
 * @notice Upgradeable escrow contract for x402 deferred payment scheme
 * @dev Implements voucher-based payments with EIP-712 signatures using UUPS proxy pattern
 */
contract DeferredPaymentEscrowUpgradeable is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    EIP712Upgradeable,
    ReentrancyGuardUpgradeable
{
    using ECDSA for bytes32;

    // ============ Structs ============

    struct Voucher {
        bytes32 id;              // Unique session ID
        address buyer;           // Payment initiator
        address seller;          // Payment recipient
        uint256 valueAggregate;  // Total amount (monotonically increasing)
        address asset;           // ERC-20 token address
        uint64 timestamp;        // Last update time
        uint256 nonce;           // Increments with each update
        address escrow;          // This contract address
        uint256 chainId;         // Network chain ID
    }

    struct DepositAuthorization {
        address buyer;
        address seller;
        address asset;
        uint256 amount;
        uint256 validAfter;
        uint256 validBefore;
        bytes32 nonce;
    }

    struct FlushRequest {
        address buyer;
        address seller;
        address asset;
        uint256 validAfter;
        uint256 validBefore;
        bytes32 nonce;
    }

    struct ThawData {
        uint256 amount;
        uint256 thawTime;
    }

    // ============ State Variables ============

    // buyer => seller => asset => balance
    mapping(address => mapping(address => mapping(address => uint256))) public deposits;

    // buyer => seller => asset => claimed amount
    mapping(address => mapping(address => mapping(address => uint256))) public claimedAmounts;

    // voucher ID => nonce => claimed status
    mapping(bytes32 => mapping(uint256 => bool)) public voucherClaimed;

    // buyer => seller => asset => thaw data
    mapping(address => mapping(address => mapping(address => ThawData))) public thaws;

    // authorization nonces (prevents replay)
    mapping(address => mapping(bytes32 => bool)) public authorizationUsed;

    // ============ Constants ============

    uint256 public constant THAW_PERIOD = 1 days;
    uint256 public constant MAX_DEPOSIT = 10_000_000; // $10 (6 decimals)

    bytes32 private constant VOUCHER_TYPEHASH = keccak256(
        "Voucher(bytes32 id,address buyer,address seller,uint256 valueAggregate,address asset,uint64 timestamp,uint256 nonce,address escrow,uint256 chainId)"
    );

    bytes32 private constant DEPOSIT_AUTHORIZATION_TYPEHASH = keccak256(
        "DepositAuthorization(address buyer,address seller,address asset,uint256 amount,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    bytes32 private constant FLUSH_REQUEST_TYPEHASH = keccak256(
        "FlushRequest(address buyer,address seller,address asset,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    // ============ Storage Gap ============
    // Reserve storage slots for future upgrades
    uint256[50] private __gap;

    // ============ Events ============

    event Deposited(address indexed buyer, address indexed seller, address indexed asset, uint256 amount);
    event VoucherClaimed(bytes32 indexed voucherId, uint256 nonce, address indexed buyer, address indexed seller, uint256 amount);
    event ThawStarted(address indexed buyer, address indexed seller, address indexed asset, uint256 amount);
    event Withdrawn(address indexed buyer, address indexed seller, address indexed asset, uint256 amount);
    event Upgraded(address indexed implementation, string version);

    // ============ Errors ============

    error InvalidSignature();
    error InsufficientBalance();
    error VoucherAlreadyClaimed();
    error InvalidVoucher();
    error DepositTooLarge();
    error ThawNotReady();
    error InvalidAuthorization();
    error AuthorizationUsed();

    // ============ Constructor & Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract (replaces constructor for upgradeable contracts)
     * @param _owner The contract owner address
     */
    function initialize(address _owner) public initializer {
        __EIP712_init("X402DeferredEscrow", "1");
        __ReentrancyGuard_init();
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
    }

    /**
     * @notice Authorize upgrade to new implementation (only owner)
     * @param newImplementation Address of the new implementation contract
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}

    /**
     * @notice Get the current version of the contract
     */
    function version() public pure returns (string memory) {
        return "1.0.0";
    }

    // ============ Deposit Functions ============

    /**
     * @notice Deposit tokens to escrow for a specific seller
     * @param seller The seller address
     * @param asset The ERC-20 token address
     * @param amount The amount to deposit
     */
    function deposit(address seller, address asset, uint256 amount) external nonReentrant {
        if (deposits[msg.sender][seller][asset] + amount > MAX_DEPOSIT) {
            revert DepositTooLarge();
        }

        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        deposits[msg.sender][seller][asset] += amount;

        emit Deposited(msg.sender, seller, asset, amount);
    }

    /**
     * @notice Deposit with ERC-2612 permit (gasless)
     */
    function depositWithPermit(
        address seller,
        address asset,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        if (deposits[msg.sender][seller][asset] + amount > MAX_DEPOSIT) {
            revert DepositTooLarge();
        }

        IERC20Permit(asset).permit(msg.sender, address(this), amount, deadline, v, r, s);
        IERC20(asset).transferFrom(msg.sender, address(this), amount);
        deposits[msg.sender][seller][asset] += amount;

        emit Deposited(msg.sender, seller, asset, amount);
    }

    /**
     * @notice Deposit with signed authorization (gasless)
     */
    function depositWithAuthorization(
        DepositAuthorization calldata auth,
        bytes calldata signature
    ) external nonReentrant {
        if (block.timestamp < auth.validAfter || block.timestamp > auth.validBefore) {
            revert InvalidAuthorization();
        }

        if (authorizationUsed[auth.buyer][auth.nonce]) {
            revert AuthorizationUsed();
        }

        bytes32 structHash = keccak256(abi.encode(
            DEPOSIT_AUTHORIZATION_TYPEHASH,
            auth.buyer,
            auth.seller,
            auth.asset,
            auth.amount,
            auth.validAfter,
            auth.validBefore,
            auth.nonce
        ));

        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);

        if (signer != auth.buyer) {
            revert InvalidSignature();
        }

        authorizationUsed[auth.buyer][auth.nonce] = true;

        if (deposits[auth.buyer][auth.seller][auth.asset] + auth.amount > MAX_DEPOSIT) {
            revert DepositTooLarge();
        }

        IERC20(auth.asset).transferFrom(auth.buyer, address(this), auth.amount);
        deposits[auth.buyer][auth.seller][auth.asset] += auth.amount;

        emit Deposited(auth.buyer, auth.seller, auth.asset, auth.amount);
    }

    // ============ Claim Functions ============

    /**
     * @notice Claim a voucher
     * @param voucher The voucher data
     * @param signature The buyer's EIP-712 signature
     */
    function claimVoucher(Voucher calldata voucher, bytes calldata signature) external nonReentrant {
        _validateAndClaimVoucher(voucher, signature);
    }

    /**
     * @notice Batch claim multiple vouchers
     */
    function claimVoucherBatch(
        Voucher[] calldata vouchers,
        bytes[] calldata signatures
    ) external nonReentrant {
        if (vouchers.length != signatures.length) {
            revert InvalidVoucher();
        }

        for (uint256 i = 0; i < vouchers.length; i++) {
            _validateAndClaimVoucher(vouchers[i], signatures[i]);
        }
    }

    function _validateAndClaimVoucher(Voucher calldata voucher, bytes calldata signature) private {
        // Validate voucher
        if (voucher.escrow != address(this)) revert InvalidVoucher();
        if (voucher.chainId != block.chainid) revert InvalidVoucher();
        if (voucherClaimed[voucher.id][voucher.nonce]) revert VoucherAlreadyClaimed();

        // Verify signature
        bytes32 structHash = keccak256(abi.encode(
            VOUCHER_TYPEHASH,
            voucher.id,
            voucher.buyer,
            voucher.seller,
            voucher.valueAggregate,
            voucher.asset,
            voucher.timestamp,
            voucher.nonce,
            voucher.escrow,
            voucher.chainId
        ));

        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);

        if (signer != voucher.buyer) {
            revert InvalidSignature();
        }

        // Calculate claimable amount
        uint256 previouslyClaimed = claimedAmounts[voucher.buyer][voucher.seller][voucher.asset];
        uint256 claimableAmount = voucher.valueAggregate - previouslyClaimed;

        if (claimableAmount == 0) return;

        // Check balance
        uint256 availableBalance = getAvailableBalance(voucher.buyer, voucher.seller, voucher.asset);
        if (availableBalance < claimableAmount) {
            revert InsufficientBalance();
        }

        // Update state
        voucherClaimed[voucher.id][voucher.nonce] = true;
        claimedAmounts[voucher.buyer][voucher.seller][voucher.asset] += claimableAmount;
        deposits[voucher.buyer][voucher.seller][voucher.asset] -= claimableAmount;

        // Transfer to seller
        IERC20(voucher.asset).transfer(voucher.seller, claimableAmount);

        emit VoucherClaimed(voucher.id, voucher.nonce, voucher.buyer, voucher.seller, claimableAmount);
    }

    // ============ Withdrawal Functions (Buyer) ============

    /**
     * @notice Start thaw period for withdrawal
     */
    function thaw(address seller, address asset, uint256 amount) external {
        uint256 available = getAvailableBalance(msg.sender, seller, asset);
        if (amount > available) {
            revert InsufficientBalance();
        }

        thaws[msg.sender][seller][asset] = ThawData({
            amount: amount,
            thawTime: block.timestamp + THAW_PERIOD
        });

        emit ThawStarted(msg.sender, seller, asset, amount);
    }

    /**
     * @notice Withdraw after thaw period
     */
    function withdraw(address seller, address asset) external nonReentrant {
        ThawData memory thawData = thaws[msg.sender][seller][asset];

        if (block.timestamp < thawData.thawTime) {
            revert ThawNotReady();
        }

        uint256 amount = thawData.amount;
        delete thaws[msg.sender][seller][asset];

        deposits[msg.sender][seller][asset] -= amount;
        IERC20(asset).transfer(msg.sender, amount);

        emit Withdrawn(msg.sender, seller, asset, amount);
    }

    /**
     * @notice Gasless thaw+withdraw with signed request
     */
    function flush(FlushRequest calldata request, bytes calldata signature) external nonReentrant {
        if (block.timestamp < request.validAfter || block.timestamp > request.validBefore) {
            revert InvalidAuthorization();
        }

        if (authorizationUsed[request.buyer][request.nonce]) {
            revert AuthorizationUsed();
        }

        bytes32 structHash = keccak256(abi.encode(
            FLUSH_REQUEST_TYPEHASH,
            request.buyer,
            request.seller,
            request.asset,
            request.validAfter,
            request.validBefore,
            request.nonce
        ));

        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);

        if (signer != request.buyer) {
            revert InvalidSignature();
        }

        authorizationUsed[request.buyer][request.nonce] = true;

        uint256 amount = getAvailableBalance(request.buyer, request.seller, request.asset);
        if (amount == 0) return;

        deposits[request.buyer][request.seller][request.asset] -= amount;
        IERC20(request.asset).transfer(request.buyer, amount);

        emit Withdrawn(request.buyer, request.seller, request.asset, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Get available balance (total deposit - claimed - thawing)
     */
    function getAvailableBalance(
        address buyer,
        address seller,
        address asset
    ) public view returns (uint256) {
        uint256 totalDeposit = deposits[buyer][seller][asset];
        uint256 thawAmount = thaws[buyer][seller][asset].amount;

        if (totalDeposit < thawAmount) {
            return 0;
        }

        return totalDeposit - thawAmount;
    }

    /**
     * @notice Get total deposit amount
     */
    function getDepositAmount(
        address buyer,
        address seller,
        address asset
    ) external view returns (uint256) {
        return deposits[buyer][seller][asset];
    }

    /**
     * @notice Get claimed amount for buyer-seller pair
     */
    function getClaimedAmount(
        address buyer,
        address seller,
        address asset
    ) external view returns (uint256) {
        return claimedAmounts[buyer][seller][asset];
    }

    /**
     * @notice Get implementation address (for transparency)
     */
    function getImplementation() external view returns (address) {
        return _getImplementation();
    }
}
