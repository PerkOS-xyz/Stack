// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IReputationRegistry
 * @notice ERC-8004 Reputation Registry Interface (v2)
 * @dev v2 changes:
 *      - score (uint8 0-100) replaced with int128 value + uint8 valueDecimals
 *      - Allows negative values, decimal precision (0-18 decimals)
 *      - Example: uptime 99.77% = (9977, 2), negative sentiment = (-50, 0)
 *      - appendResponse callable by anyone (not just agent owner)
 *      - readAllFeedback includes feedbackIndexes in return
 *      - getSummary returns (count, summaryValue, summaryValueDecimals)
 *      - Added getResponseCount
 */
interface IReputationRegistry {
    // ============ Events ============

    /// @notice Emitted when feedback is given to an agent
    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        int128 value,
        uint8 valueDecimals,
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

    // ============ Structs ============

    /// @notice Feedback entry structure (v2: int128 value + valueDecimals)
    struct Feedback {
        address client;
        int128 value;             // Signed value (can be negative)
        uint8 valueDecimals;      // 0-18 decimal places
        string tag1;
        string tag2;
        string endpoint;
        string feedbackURI;
        bytes32 feedbackHash;
        uint256 timestamp;
        bool isRevoked;
    }

    /// @notice Response entry for a feedback
    struct Response {
        address responder;
        string responseURI;
        bytes32 responseHash;
        uint256 timestamp;
    }

    /// @notice Aggregated reputation summary (v2)
    struct ReputationSummary {
        uint64 count;
        int128 summaryValue;
        uint8 summaryValueDecimals;
    }

    // ============ Feedback Functions ============

    /**
     * @notice Give feedback with full parameters (v2: int128 value + valueDecimals)
     * @param agentId The agent's ID in the Identity Registry
     * @param value Feedback value (int128 — can be negative)
     * @param valueDecimals Number of decimal places (0-18)
     * @param tag1 Optional categorization tag
     * @param tag2 Optional second categorization tag
     * @param endpoint Optional endpoint reference
     * @param feedbackURI Optional URI to detailed feedback JSON
     * @param feedbackHash Optional hash of off-chain feedback content
     */
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    /**
     * @notice Simple feedback with just value (convenience method)
     * @param agentId The agent's ID
     * @param value Feedback value (int128)
     * @param valueDecimals Number of decimal places (0-18)
     */
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals
    ) external;

    /**
     * @notice Revoke previously given feedback
     * @param agentId The agent's ID
     * @param feedbackIndex The feedback index to revoke
     */
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external;

    /**
     * @notice Append response to feedback (callable by anyone per v2 spec)
     * @param agentId The agent's ID
     * @param clientAddress The client who gave the feedback
     * @param feedbackIndex The feedback index
     * @param responseURI URI to response content
     * @param responseHash Hash of response content (optional)
     */
    function appendResponse(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        string calldata responseURI,
        bytes32 responseHash
    ) external;

    // ============ Query Functions ============

    /**
     * @notice Get reputation summary with filtering (v2)
     * @param agentId The agent's ID
     * @param clientAddresses Filter by specific clients (empty = all)
     * @param tag1 Filter by tag1 (empty = all)
     * @param tag2 Filter by tag2 (empty = all)
     * @return count Number of matching feedbacks
     * @return summaryValue Aggregated value
     * @return summaryValueDecimals Decimals of the summary value
     */
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);

    /**
     * @notice Read specific feedback entry (v2)
     * @return value The feedback value (int128)
     * @return valueDecimals Decimal places
     * @return tag1 First tag
     * @return tag2 Second tag
     * @return isRevoked Whether feedback was revoked
     */
    function readFeedback(
        uint256 agentId,
        address clientAddress,
        uint64 index
    ) external view returns (
        int128 value,
        uint8 valueDecimals,
        string memory tag1,
        string memory tag2,
        bool isRevoked
    );

    /**
     * @notice Read all feedback with filtering (v2: includes feedbackIndexes)
     */
    function readAllFeedback(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2,
        bool includeRevoked
    ) external view returns (
        address[] memory clients,
        uint64[] memory feedbackIndexes,
        int128[] memory values,
        uint8[] memory valueDecimals,
        string[] memory tag1s,
        string[] memory tag2s,
        bool[] memory revoked
    );

    /**
     * @notice Get all clients who have given feedback to an agent
     */
    function getClients(uint256 agentId) external view returns (address[] memory clients);

    /**
     * @notice Get the last feedback index for a specific client
     */
    function getLastIndex(
        uint256 agentId,
        address clientAddress
    ) external view returns (uint64 lastIndex);

    /**
     * @notice Get response count for a specific feedback entry
     * @param agentId The agent's ID
     * @param clientAddress The client who gave feedback
     * @param feedbackIndex The feedback index
     * @param responders Filter by responder addresses (empty = all)
     * @return count Number of responses
     */
    function getResponseCount(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        address[] calldata responders
    ) external view returns (uint64 count);

    /**
     * @notice Get the Identity Registry address
     */
    function identityRegistry() external view returns (address registry);
}
