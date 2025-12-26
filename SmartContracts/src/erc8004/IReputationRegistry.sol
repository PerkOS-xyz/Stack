// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IReputationRegistry
 * @notice ERC-8004 Reputation Registry Interface
 * @dev Implements on-chain feedback system for agent reputation
 *      Feedback is cryptographically signed and can be revoked
 */
interface IReputationRegistry {
    // ============ Events ============

    /// @notice Emitted when feedback is given to an agent
    event FeedbackGiven(
        uint256 indexed agentId,
        address indexed client,
        uint256 indexed index,
        int8 rating,
        string comment
    );

    /// @notice Emitted when feedback is revoked
    event FeedbackRevoked(
        uint256 indexed agentId,
        address indexed client,
        uint256 indexed index
    );

    /// @notice Emitted when agent responds to feedback
    event ResponseAppended(
        uint256 indexed agentId,
        uint256 indexed feedbackIndex,
        string response
    );

    // ============ Structs ============

    /// @notice Authorization structure for giving feedback
    struct FeedbackAuth {
        uint256 agentId;
        address client;
        uint256 nonce;
        uint256 deadline;
    }

    /// @notice Feedback entry structure
    struct Feedback {
        address client;
        int8 rating;           // -100 to +100 scale
        string comment;
        uint256 timestamp;
        bool revoked;
        string response;       // Agent's response to feedback
    }

    /// @notice Aggregated reputation summary
    struct ReputationSummary {
        uint256 totalFeedback;
        uint256 activeFeedback;    // Non-revoked feedback count
        int256 averageRating;      // Scaled by 100 for precision
        uint256 positiveCount;
        uint256 negativeCount;
        uint256 neutralCount;
        uint256 lastUpdated;
    }

    // ============ Functions ============

    /**
     * @notice Give feedback to an agent
     * @param agentId The agent's ID in the Identity Registry
     * @param rating Rating from -100 to +100
     * @param comment Feedback comment
     * @param auth Authorization structure
     * @param signature Client's signature over FeedbackAuth
     * @return index The feedback index
     */
    function giveFeedback(
        uint256 agentId,
        int8 rating,
        string calldata comment,
        FeedbackAuth calldata auth,
        bytes calldata signature
    ) external returns (uint256 index);

    /**
     * @notice Give feedback without signature (msg.sender is client)
     * @param agentId The agent's ID
     * @param rating Rating from -100 to +100
     * @param comment Feedback comment
     * @return index The feedback index
     */
    function giveFeedback(
        uint256 agentId,
        int8 rating,
        string calldata comment
    ) external returns (uint256 index);

    /**
     * @notice Revoke previously given feedback
     * @param agentId The agent's ID
     * @param index The feedback index to revoke
     */
    function revokeFeedback(uint256 agentId, uint256 index) external;

    /**
     * @notice Append agent response to feedback
     * @param agentId The agent's ID
     * @param index The feedback index
     * @param response The agent's response
     */
    function appendResponse(
        uint256 agentId,
        uint256 index,
        string calldata response
    ) external;

    /**
     * @notice Get reputation summary for an agent
     * @param agentId The agent's ID
     * @return summary Aggregated reputation data
     */
    function getSummary(uint256 agentId) external view returns (ReputationSummary memory summary);

    /**
     * @notice Read specific feedback entry
     * @param agentId The agent's ID
     * @param index The feedback index
     * @return feedback The feedback entry
     */
    function readFeedback(uint256 agentId, uint256 index) external view returns (Feedback memory feedback);

    /**
     * @notice Read all feedback for an agent
     * @param agentId The agent's ID
     * @return feedbacks Array of all feedback entries
     */
    function readAllFeedback(uint256 agentId) external view returns (Feedback[] memory feedbacks);

    /**
     * @notice Get the last feedback index for an agent
     * @param agentId The agent's ID
     * @return lastIndex The last index (or 0 if no feedback)
     */
    function getLastIndex(uint256 agentId) external view returns (uint256 lastIndex);

    /**
     * @notice Get all clients who have given feedback to an agent
     * @param agentId The agent's ID
     * @return clients Array of client addresses
     */
    function getClients(uint256 agentId) external view returns (address[] memory clients);

    /**
     * @notice Check if a client has given feedback to an agent
     * @param agentId The agent's ID
     * @param client The client address
     * @return hasFeedback True if client has given feedback
     */
    function hasClientFeedback(uint256 agentId, address client) external view returns (bool hasFeedback);

    /**
     * @notice Get the Identity Registry address
     * @return registry The Identity Registry contract address
     */
    function identityRegistry() external view returns (address registry);
}
