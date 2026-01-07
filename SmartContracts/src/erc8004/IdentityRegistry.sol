// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC1271.sol";
import "./IIdentityRegistry.sol";

/**
 * @title IdentityRegistry
 * @notice ERC-8004 Identity Registry - NFT-based agent identity system
 * @dev Implements ERC-721 with URIStorage for agent registration
 *      Each agent gets a unique NFT that resolves to their registration file
 *
 *      Global Agent Identifier Format:
 *      {namespace}:{chainId}:{identityRegistry}:{agentId}
 *      Example: eip155:1:0x742d35Cc6634C0532925a3b844Bc9e7595f:22
 */
contract IdentityRegistry is
    Initializable,
    ERC721Upgradeable,
    ERC721URIStorageUpgradeable,
    ERC721EnumerableUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    EIP712Upgradeable,
    IIdentityRegistry
{
    using ECDSAUpgradeable for bytes32;

    /// @notice Counter for generating unique agent IDs
    uint256 private _nextAgentId;

    /// @notice Mapping from agentId => key => value for on-chain metadata (string values per EIP-8004)
    mapping(uint256 => mapping(string => string)) private _metadata;

    /// @notice Mapping from owner address to their agent IDs
    mapping(address => uint256[]) private _ownerAgents;

    /// @notice Mapping from agentId => wallet address (separate from NFT owner)
    mapping(uint256 => address) private _agentWallets;

    /// @notice EIP-712 typehash for wallet change authorization
    bytes32 private constant WALLET_CHANGE_TYPEHASH =
        keccak256("WalletChange(uint256 agentId,address newWallet,uint256 deadline)");

    /// @notice ERC-1271 magic value for valid signature
    bytes4 private constant ERC1271_MAGIC_VALUE = 0x1626ba7e;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract (replaces constructor for upgradeable)
     * @param name_ The name of the NFT collection
     * @param symbol_ The symbol of the NFT collection
     */
    function initialize(
        string memory name_,
        string memory symbol_
    ) public initializer {
        __ERC721_init(name_, symbol_);
        __ERC721URIStorage_init();
        __ERC721Enumerable_init();
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __EIP712_init("ERC8004IdentityRegistry", "1");
        _nextAgentId = 1; // Start from 1, 0 is reserved
    }

    // ============ Registration Functions ============

    /**
     * @notice Register a new agent with agentURI and metadata
     * @param agentURI_ URI pointing to the agent's registration JSON file
     * @param metadata Array of key-value metadata entries
     * @return agentId The newly minted agent NFT token ID
     */
    function register(
        string calldata agentURI_,
        MetadataEntry[] calldata metadata
    ) external override returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI_);

        // Set all metadata entries
        for (uint256 i = 0; i < metadata.length; i++) {
            _metadata[agentId][metadata[i].key] = metadata[i].value;
            emit MetadataSet(agentId, metadata[i].key, metadata[i].key, metadata[i].value);
        }

        _ownerAgents[msg.sender].push(agentId);
        emit Registered(agentId, agentURI_, msg.sender);
    }

    /**
     * @notice Register a new agent with just agentURI
     * @param agentURI_ URI pointing to the agent's registration JSON file
     * @return agentId The newly minted agent NFT token ID
     */
    function register(string calldata agentURI_) external override returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI_);
        _ownerAgents[msg.sender].push(agentId);
        emit Registered(agentId, agentURI_, msg.sender);
    }

    /**
     * @notice Register a new agent with default/empty agentURI
     * @return agentId The newly minted agent NFT token ID
     */
    function register() external override returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _ownerAgents[msg.sender].push(agentId);
        emit Registered(agentId, "", msg.sender);
    }

    // ============ URI Functions ============

    /**
     * @notice Update the agentURI for an agent (only owner/operator)
     * @param agentId The agent's token ID
     * @param newURI New URI pointing to the agent's registration JSON file
     */
    function setAgentURI(uint256 agentId, string calldata newURI) external override {
        require(
            _isAuthorized(_ownerOf(agentId), msg.sender, agentId),
            "Not authorized"
        );
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    // ============ Wallet Functions (EIP-8004 Compliant) ============

    /**
     * @notice Update the agent's wallet address with signature verification
     * @dev Requires EIP-712 signature from EOA or ERC-1271 signature from smart contract
     *      The signature must be from the current wallet (or owner if no wallet set)
     * @param agentId The agent's token ID
     * @param newWallet The new wallet address
     * @param deadline Signature validity deadline
     * @param signature The signature authorizing the wallet change
     */
    function setAgentWallet(
        uint256 agentId,
        address newWallet,
        uint256 deadline,
        bytes calldata signature
    ) external override {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        require(block.timestamp <= deadline, "Signature expired");
        require(newWallet != address(0), "Invalid wallet address");

        // Get current wallet (defaults to owner if not set)
        address currentWallet = _agentWallets[agentId];
        if (currentWallet == address(0)) {
            currentWallet = _ownerOf(agentId);
        }

        // Build EIP-712 digest
        bytes32 structHash = keccak256(abi.encode(
            WALLET_CHANGE_TYPEHASH,
            agentId,
            newWallet,
            deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);

        // Verify signature - try EIP-712 first, then ERC-1271
        bool isValid = _verifySignature(currentWallet, digest, signature);
        require(isValid, "Invalid signature");

        // Update wallet
        address oldWallet = _agentWallets[agentId];
        _agentWallets[agentId] = newWallet;
        emit AgentWalletUpdated(agentId, oldWallet, newWallet);
    }

    /**
     * @notice Get the agent's wallet address
     * @param agentId The agent's token ID
     * @return wallet The agent's wallet address (defaults to owner if not set)
     */
    function getAgentWallet(uint256 agentId) external view override returns (address wallet) {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        wallet = _agentWallets[agentId];
        if (wallet == address(0)) {
            wallet = _ownerOf(agentId);
        }
    }

    /**
     * @dev Verify signature using EIP-712 (EOA) or ERC-1271 (smart contract)
     */
    function _verifySignature(
        address signer,
        bytes32 digest,
        bytes calldata signature
    ) internal view returns (bool) {
        // Try ECDSA recovery first (for EOAs)
        (address recovered, ECDSAUpgradeable.RecoverError error, ) = ECDSAUpgradeable.tryRecover(digest, signature);
        if (error == ECDSAUpgradeable.RecoverError.NoError && recovered == signer) {
            return true;
        }

        // Try ERC-1271 (for smart contract wallets)
        if (signer.code.length > 0) {
            try IERC1271(signer).isValidSignature(digest, signature) returns (bytes4 magicValue) {
                return magicValue == ERC1271_MAGIC_VALUE;
            } catch {
                return false;
            }
        }

        return false;
    }

    // ============ Metadata Functions ============

    /**
     * @notice Get metadata value for an agent
     * @param agentId The agent's token ID
     * @param metadataKey The metadata key to retrieve
     * @return metadataValue The metadata value as string
     */
    function getMetadata(
        uint256 agentId,
        string calldata metadataKey
    ) external view override returns (string memory metadataValue) {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        return _metadata[agentId][metadataKey];
    }

    /**
     * @notice Set metadata for an agent (only owner/operator)
     * @param agentId The agent's token ID
     * @param metadataKey The metadata key
     * @param metadataValue The metadata value as string
     */
    function setMetadata(
        uint256 agentId,
        string calldata metadataKey,
        string calldata metadataValue
    ) external override {
        require(
            _isAuthorized(_ownerOf(agentId), msg.sender, agentId),
            "Not authorized"
        );
        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    // ============ Query Functions ============

    /**
     * @notice Get all agent IDs owned by an address
     * @param owner The owner address
     * @return Array of agent IDs
     */
    function getAgentsByOwner(address owner) external view override returns (uint256[] memory) {
        return _ownerAgents[owner];
    }

    /**
     * @notice Get the total number of registered agents
     * @return Total count of agents
     */
    function totalAgents() external view override returns (uint256) {
        return _nextAgentId - 1;
    }

    /**
     * @notice Get the next agent ID that will be assigned
     * @return Next agent ID
     */
    function nextAgentId() external view override returns (uint256) {
        return _nextAgentId;
    }

    // ============ Backward Compatibility (Deprecated) ============

    /**
     * @notice Deprecated: Use setAgentURI instead
     * @dev Kept for backward compatibility
     */
    function setTokenURI(uint256 agentId, string calldata tokenURI_) external {
        require(
            _isAuthorized(_ownerOf(agentId), msg.sender, agentId),
            "Not authorized"
        );
        _setTokenURI(agentId, tokenURI_);
        emit URIUpdated(agentId, tokenURI_, msg.sender);
    }

    // ============ Required Overrides ============

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(
        address account,
        uint128 value
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
        super._increaseBalance(account, value);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721Upgradeable, ERC721URIStorageUpgradeable, IIdentityRegistry) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function ownerOf(
        uint256 tokenId
    ) public view override(ERC721Upgradeable, IIdentityRegistry) returns (address) {
        return super.ownerOf(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721URIStorageUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @notice Get contract version
     * @return Version string
     */
    function version() external pure returns (string memory) {
        return "2.0.0";
    }
}
