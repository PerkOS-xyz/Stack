// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IReputationRegistry
 * @notice ERC-8004 Reputation Registry Interface
 * @dev Standardized feedback collection with on-chain composability
 *      and off-chain aggregation capabilities
 *
 * Key Features:
 * - Score range: 0-100 (mandatory)
 * - Optional tag1, tag2 for categorization
 * - Optional feedbackURI/feedbackHash for off-chain evidence
 * - Filtering by reviewer addresses and tags
 */
interface IReputationRegistry {
    // ============ Events (EIP-8004 Compliant) ============

    /// @notice Emitted when feedback is given to an agent
    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint8 score,
        string indexed tag1,
        string tag2,
        string endpoint,
        string feedbackURI,
        bytes32 feedbackHash
    );

    /// @notice Emitted when feedback is revoked
    event FeedbackRevoked(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 indexed feedbackIndex
    );

    /// @notice Emitted when a response is appended
    event ResponseAppended(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        address indexed responder,
        string responseURI
    );

    // ============ Structs (EIP-8004 Compliant) ============

    /// @notice Feedback entry structure per EIP-8004
    struct Feedback {
        address client;
        uint8 score;              // 0-100 scale (EIP-8004 compliant)
        string tag1;              // Optional categorization tag
        string tag2;              // Optional categorization tag
        string endpoint;          // Optional endpoint reference
        string feedbackURI;       // Optional URI to detailed feedback
        bytes32 feedbackHash;     // Optional hash of off-chain feedback
        uint256 timestamp;
        bool isRevoked;
        string responseURI;       // Agent's response URI
        bytes32 responseHash;     // Hash of response content
    }

    /// @notice Aggregated reputation summary
    struct ReputationSummary {
        uint64 count;
        uint8 averageScore;       // 0-100
    }

    // ============ Feedback Functions (EIP-8004 Compliant) ============

    /**
     * @notice Give feedback to an agent with full parameters
     * @param agentId The agent's ID in the Identity Registry
     * @param score Score from 0 to 100 (0 = worst, 100 = best)
     * @param tag1 Optional categorization tag (e.g., "quality", "speed")
     * @param tag2 Optional second categorization tag
     * @param endpoint Optional endpoint that was used
     * @param feedbackURI Optional URI to detailed feedback JSON
     * @param feedbackHash Optional hash of off-chain feedback content
     */
    function giveFeedback(
        uint256 agentId,
        uint8 score,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    /**
     * @notice Simple feedback with just score (convenience method)
     * @param agentId The agent's ID
     * @param score Score from 0 to 100
     */
    function giveFeedback(
        uint256 agentId,
        uint8 score
    ) external;

    /**
     * @notice Revoke previously given feedback
     * @param agentId The agent's ID
     * @param feedbackIndex The feedback index to revoke
     */
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external;

    /**
     * @notice Append agent response to feedback
     * @param agentId The agent's ID
     * @param clientAddress The client who gave the feedback
     * @param feedbackIndex The feedback index
     * @param responseURI URI to response content
     * @param responseHash Hash of response content (optional, can be bytes32(0))
     */
    function appendResponse(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        string calldata responseURI,
        bytes32 responseHash
    ) external;

    // ============ Query Functions (EIP-8004 Compliant) ============

    /**
     * @notice Get reputation summary with filtering
     * @param agentId The agent's ID
     * @param clientAddresses Filter by specific clients (empty = all)
     * @param tag1 Filter by tag1 (empty = all)
     * @param tag2 Filter by tag2 (empty = all)
     * @return count Number of matching feedbacks
     * @return averageScore Average score of matching feedbacks
     */
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, uint8 averageScore);

    /**
     * @notice Read specific feedback entry
     * @param agentId The agent's ID
     * @param clientAddress The client who gave feedback
     * @param index The feedback index for this client
     * @return score The score given
     * @return tag1 First tag
     * @return tag2 Second tag
     * @return isRevoked Whether feedback was revoked
     */
    function readFeedback(
        uint256 agentId,
        address clientAddress,
        uint64 index
    ) external view returns (
        uint8 score,
        string memory tag1,
        string memory tag2,
        bool isRevoked
    );

    /**
     * @notice Read all feedback with filtering
     * @param agentId The agent's ID
     * @param clientAddresses Filter by clients (empty = all)
     * @param tag1 Filter by tag1 (empty = all)
     * @param tag2 Filter by tag2 (empty = all)
     * @param includeRevoked Whether to include revoked feedback
     * @return clients Array of client addresses
     * @return scores Array of scores
     * @return tag1s Array of tag1 values
     * @return tag2s Array of tag2 values
     * @return revoked Array of revoked flags
     */
    function readAllFeedback(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2,
        bool includeRevoked
    ) external view returns (
        address[] memory clients,
        uint8[] memory scores,
        string[] memory tag1s,
        string[] memory tag2s,
        bool[] memory revoked
    );

    /**
     * @notice Get all clients who have given feedback to an agent
     * @param agentId The agent's ID
     * @return clients Array of client addresses
     */
    function getClients(uint256 agentId) external view returns (address[] memory clients);

    /**
     * @notice Get the last feedback index for a specific client
     * @param agentId The agent's ID
     * @param clientAddress The client address
     * @return lastIndex The last index (or 0 if no feedback)
     */
    function getLastIndex(
        uint256 agentId,
        address clientAddress
    ) external view returns (uint64 lastIndex);

    /**
     * @notice Get the Identity Registry address
     * @return registry The Identity Registry contract address
     */
    function identityRegistry() external view returns (address registry);
}
