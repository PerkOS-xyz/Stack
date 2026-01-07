// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IIdentityRegistry
 * @notice ERC-8004 Identity Registry Interface
 * @dev Minimal on-chain handle based on ERC-721 with URIStorage extension
 *      that resolves to an agent's registration file
 *
 * Global Agent Identifier Format:
 * {namespace}:{chainId}:{identityRegistry}:{agentId}
 * Example: eip155:1:0x742d35Cc6634C0532925a3b844Bc9e7595f:22
 */
interface IIdentityRegistry {
    // ============ Events ============

    /// @notice Emitted when an agent is registered
    event Registered(
        uint256 indexed agentId,
        string agentURI,
        address indexed owner
    );

    /// @notice Emitted when agent URI is updated
    event URIUpdated(
        uint256 indexed agentId,
        string newURI,
        address indexed updatedBy
    );

    /// @notice Emitted when metadata is set for an agent
    event MetadataSet(
        uint256 indexed agentId,
        string indexed indexedKey,
        string metadataKey,
        string metadataValue
    );

    /// @notice Emitted when agent wallet is updated
    event AgentWalletUpdated(
        uint256 indexed agentId,
        address indexed oldWallet,
        address indexed newWallet
    );

    // ============ Structs ============

    /// @notice Struct for metadata entries during registration
    struct MetadataEntry {
        string key;
        string value;
    }

    // ============ Registration Functions ============

    /**
     * @notice Register a new agent with agentURI and metadata
     * @param agentURI URI pointing to the agent's registration JSON file
     * @param metadata Array of key-value metadata entries
     * @return agentId The newly minted agent NFT token ID
     */
    function register(
        string calldata agentURI,
        MetadataEntry[] calldata metadata
    ) external returns (uint256 agentId);

    /**
     * @notice Register a new agent with just agentURI
     * @param agentURI URI pointing to the agent's registration JSON file
     * @return agentId The newly minted agent NFT token ID
     */
    function register(string calldata agentURI) external returns (uint256 agentId);

    /**
     * @notice Register a new agent with default/empty agentURI
     * @return agentId The newly minted agent NFT token ID
     */
    function register() external returns (uint256 agentId);

    // ============ URI Functions ============

    /**
     * @notice Update the agentURI for an agent (only owner/operator)
     * @param agentId The agent's token ID
     * @param newURI New URI pointing to the agent's registration JSON file
     */
    function setAgentURI(uint256 agentId, string calldata newURI) external;

    // ============ Wallet Functions (EIP-8004 Compliant) ============

    /**
     * @notice Update the agent's wallet address with signature verification
     * @dev Requires EIP-712 signature from EOA or ERC-1271 signature from smart contract
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
    ) external;

    /**
     * @notice Get the agent's wallet address
     * @param agentId The agent's token ID
     * @return wallet The agent's wallet address (defaults to owner if not set)
     */
    function getAgentWallet(uint256 agentId) external view returns (address wallet);

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
    ) external view returns (string memory metadataValue);

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
    ) external;

    // ============ Query Functions ============

    /**
     * @notice Get the owner of an agent NFT (ERC-721 standard)
     * @param agentId The agent's token ID
     * @return owner The owner address
     */
    function ownerOf(uint256 agentId) external view returns (address owner);

    /**
     * @notice Get the agentURI for an agent (ERC-721 tokenURI)
     * @param agentId The agent's token ID
     * @return uri The agent URI
     */
    function tokenURI(uint256 agentId) external view returns (string memory uri);

    /**
     * @notice Get all agent IDs owned by an address
     * @param owner The owner address
     * @return agentIds Array of agent IDs
     */
    function getAgentsByOwner(address owner) external view returns (uint256[] memory agentIds);

    /**
     * @notice Get the total number of registered agents
     * @return count Total count of agents
     */
    function totalAgents() external view returns (uint256 count);

    /**
     * @notice Get the next agent ID that will be assigned
     * @return id Next agent ID
     */
    function nextAgentId() external view returns (uint256 id);
}
