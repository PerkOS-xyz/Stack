// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./IIdentityRegistry.sol";

/**
 * @title IdentityRegistry
 * @notice ERC-8004 Identity Registry - NFT-based agent identity system
 * @dev Implements ERC-721 with URIStorage for agent registration
 *      Each agent gets a unique NFT that resolves to their registration file
 */
contract IdentityRegistry is
    Initializable,
    ERC721Upgradeable,
    ERC721URIStorageUpgradeable,
    ERC721EnumerableUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    IIdentityRegistry
{
    /// @notice Counter for generating unique agent IDs
    uint256 private _nextAgentId;

    /// @notice Mapping from agentId => key => value for on-chain metadata
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    /// @notice Mapping from owner address to their agent IDs
    mapping(address => uint256[]) private _ownerAgents;

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
        _nextAgentId = 1; // Start from 1, 0 is reserved
    }

    /**
     * @notice Register a new agent with tokenURI and metadata
     * @param tokenURI_ URI pointing to the agent's registration JSON file
     * @param metadata Array of key-value metadata entries
     * @return agentId The newly minted agent NFT token ID
     */
    function register(
        string calldata tokenURI_,
        MetadataEntry[] calldata metadata
    ) external override returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, tokenURI_);

        // Set all metadata entries
        for (uint256 i = 0; i < metadata.length; i++) {
            _metadata[agentId][metadata[i].key] = metadata[i].value;
            emit MetadataSet(agentId, metadata[i].key, metadata[i].key, metadata[i].value);
        }

        _ownerAgents[msg.sender].push(agentId);
        emit Registered(agentId, tokenURI_, msg.sender);
    }

    /**
     * @notice Register a new agent with just tokenURI
     * @param tokenURI_ URI pointing to the agent's registration JSON file
     * @return agentId The newly minted agent NFT token ID
     */
    function register(string calldata tokenURI_) external override returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, tokenURI_);
        _ownerAgents[msg.sender].push(agentId);
        emit Registered(agentId, tokenURI_, msg.sender);
    }

    /**
     * @notice Register a new agent with default/empty tokenURI
     * @return agentId The newly minted agent NFT token ID
     */
    function register() external override returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _ownerAgents[msg.sender].push(agentId);
        emit Registered(agentId, "", msg.sender);
    }

    /**
     * @notice Get metadata value for an agent
     * @param agentId The agent's token ID
     * @param key The metadata key to retrieve
     * @return value The metadata value as bytes
     */
    function getMetadata(
        uint256 agentId,
        string calldata key
    ) external view override returns (bytes memory value) {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        return _metadata[agentId][key];
    }

    /**
     * @notice Set metadata for an agent (only owner/operator)
     * @param agentId The agent's token ID
     * @param key The metadata key
     * @param value The metadata value as bytes
     */
    function setMetadata(
        uint256 agentId,
        string calldata key,
        bytes calldata value
    ) external override {
        require(
            _isAuthorized(_ownerOf(agentId), msg.sender, agentId),
            "Not authorized"
        );
        _metadata[agentId][key] = value;
        emit MetadataSet(agentId, key, key, value);
    }

    /**
     * @notice Update the tokenURI for an agent (only owner/operator)
     * @param agentId The agent's token ID
     * @param tokenURI_ New URI pointing to the agent's registration JSON file
     */
    function setTokenURI(uint256 agentId, string calldata tokenURI_) external override {
        require(
            _isAuthorized(_ownerOf(agentId), msg.sender, agentId),
            "Not authorized"
        );
        _setTokenURI(agentId, tokenURI_);
    }

    /**
     * @notice Get all agent IDs owned by an address
     * @param owner The owner address
     * @return Array of agent IDs
     */
    function getAgentsByOwner(address owner) external view returns (uint256[] memory) {
        return _ownerAgents[owner];
    }

    /**
     * @notice Get the total number of registered agents
     * @return Total count of agents
     */
    function totalAgents() external view returns (uint256) {
        return _nextAgentId - 1;
    }

    /**
     * @notice Get the next agent ID that will be assigned
     * @return Next agent ID
     */
    function nextAgentId() external view returns (uint256) {
        return _nextAgentId;
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
    ) public view override(ERC721Upgradeable, ERC721URIStorageUpgradeable) returns (string memory) {
        return super.tokenURI(tokenId);
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
        return "1.0.0";
    }
}
