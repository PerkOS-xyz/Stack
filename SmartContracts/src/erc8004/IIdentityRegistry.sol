// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IIdentityRegistry
 * @notice ERC-8004 Identity Registry Interface
 * @dev Minimal on-chain handle based on ERC-721 with URIStorage extension
 *      that resolves to an agent's registration file
 */
interface IIdentityRegistry {
    /// @notice Emitted when an agent is registered
    event Registered(
        uint256 indexed agentId,
        string tokenURI,
        address indexed owner
    );

    /// @notice Emitted when metadata is set for an agent
    event MetadataSet(
        uint256 indexed agentId,
        string indexed indexedKey,
        string key,
        bytes value
    );

    /// @notice Struct for metadata entries during registration
    struct MetadataEntry {
        string key;
        bytes value;
    }

    /**
     * @notice Register a new agent with tokenURI and metadata
     * @param tokenURI URI pointing to the agent's registration JSON file
     * @param metadata Array of key-value metadata entries
     * @return agentId The newly minted agent NFT token ID
     */
    function register(
        string calldata tokenURI,
        MetadataEntry[] calldata metadata
    ) external returns (uint256 agentId);

    /**
     * @notice Register a new agent with just tokenURI
     * @param tokenURI URI pointing to the agent's registration JSON file
     * @return agentId The newly minted agent NFT token ID
     */
    function register(string calldata tokenURI) external returns (uint256 agentId);

    /**
     * @notice Register a new agent with default/empty tokenURI
     * @return agentId The newly minted agent NFT token ID
     */
    function register() external returns (uint256 agentId);

    /**
     * @notice Get metadata value for an agent
     * @param agentId The agent's token ID
     * @param key The metadata key to retrieve
     * @return value The metadata value as bytes
     */
    function getMetadata(
        uint256 agentId,
        string calldata key
    ) external view returns (bytes memory value);

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
    ) external;

    /**
     * @notice Update the tokenURI for an agent (only owner/operator)
     * @param agentId The agent's token ID
     * @param tokenURI New URI pointing to the agent's registration JSON file
     */
    function setTokenURI(uint256 agentId, string calldata tokenURI) external;

    /**
     * @notice Get the owner of an agent NFT (ERC-721 standard)
     * @param agentId The agent's token ID
     * @return owner The owner address
     */
    function ownerOf(uint256 agentId) external view returns (address owner);

    /**
     * @notice Get the tokenURI for an agent (ERC-721 standard)
     * @param agentId The agent's token ID
     * @return uri The token URI
     */
    function tokenURI(uint256 agentId) external view returns (string memory uri);
}
