// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./IReputationRegistry.sol";
import "./IIdentityRegistry.sol";

/**
 * @title ReputationRegistry
 * @notice ERC-8004 Reputation Registry - Standardized on-chain feedback system
 * @dev Implements standardized feedback collection per EIP-8004:
 *      - Score range: 0-100 (mandatory)
 *      - Optional tag1, tag2 for categorization
 *      - Optional feedbackURI/feedbackHash for off-chain evidence
 *      - Filtering by reviewer addresses and tags
 */
contract ReputationRegistry is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    IReputationRegistry
{
    /// @notice Reference to the Identity Registry
    address private _identityRegistry;

    /// @notice Mapping from agentId => client => feedbacks array
    mapping(uint256 => mapping(address => Feedback[])) private _feedbacks;

    /// @notice Mapping from agentId => clients array
    mapping(uint256 => address[]) private _agentClients;

    /// @notice Mapping from agentId => client => has given feedback
    mapping(uint256 => mapping(address => bool)) private _hasClientFeedback;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     * @param identityRegistry_ Address of the Identity Registry
     */
    function initialize(address identityRegistry_) public initializer {
        require(identityRegistry_ != address(0), "Invalid identity registry");
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        _identityRegistry = identityRegistry_;
    }

    // ============ Feedback Functions ============

    /**
     * @notice Give feedback with full parameters (EIP-8004 compliant)
     */
    function giveFeedback(
        uint256 agentId,
        uint8 score,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external override {
        _giveFeedback(agentId, msg.sender, score, tag1, tag2, endpoint, feedbackURI, feedbackHash);
    }

    /**
     * @notice Simple feedback with just score
     */
    function giveFeedback(
        uint256 agentId,
        uint8 score
    ) external override {
        _giveFeedback(agentId, msg.sender, score, "", "", "", "", bytes32(0));
    }

    /**
     * @dev Internal function to give feedback
     */
    function _giveFeedback(
        uint256 agentId,
        address client,
        uint8 score,
        string memory tag1,
        string memory tag2,
        string memory endpoint,
        string memory feedbackURI,
        bytes32 feedbackHash
    ) internal {
        // Verify agent exists in Identity Registry
        require(_agentExists(agentId), "Agent does not exist");
        require(score <= 100, "Score must be 0-100");

        // Track client
        if (!_hasClientFeedback[agentId][client]) {
            _hasClientFeedback[agentId][client] = true;
            _agentClients[agentId].push(client);
        }

        // Create feedback entry
        _feedbacks[agentId][client].push(Feedback({
            client: client,
            score: score,
            tag1: tag1,
            tag2: tag2,
            endpoint: endpoint,
            feedbackURI: feedbackURI,
            feedbackHash: feedbackHash,
            timestamp: block.timestamp,
            isRevoked: false,
            responseURI: "",
            responseHash: bytes32(0)
        }));

        emit NewFeedback(agentId, client, score, tag1, tag2, endpoint, feedbackURI, feedbackHash);
    }

    /**
     * @notice Revoke previously given feedback
     */
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external override {
        Feedback[] storage clientFeedbacks = _feedbacks[agentId][msg.sender];
        require(feedbackIndex < clientFeedbacks.length, "Invalid feedback index");
        require(!clientFeedbacks[feedbackIndex].isRevoked, "Already revoked");

        clientFeedbacks[feedbackIndex].isRevoked = true;
        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    /**
     * @notice Append agent response to feedback (EIP-8004 compliant)
     */
    function appendResponse(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        string calldata responseURI,
        bytes32 responseHash
    ) external override {
        require(_isAgentOwner(agentId, msg.sender), "Not agent owner");

        Feedback[] storage clientFeedbacks = _feedbacks[agentId][clientAddress];
        require(feedbackIndex < clientFeedbacks.length, "Invalid feedback index");
        require(!clientFeedbacks[feedbackIndex].isRevoked, "Feedback was revoked");
        require(bytes(clientFeedbacks[feedbackIndex].responseURI).length == 0, "Response already exists");

        clientFeedbacks[feedbackIndex].responseURI = responseURI;
        clientFeedbacks[feedbackIndex].responseHash = responseHash;

        emit ResponseAppended(agentId, clientAddress, feedbackIndex, msg.sender, responseURI);
    }

    // ============ Query Functions (EIP-8004 Compliant) ============

    /**
     * @notice Get reputation summary with filtering
     */
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view override returns (uint64 count, uint8 averageScore) {
        address[] memory clients = clientAddresses.length > 0
            ? clientAddresses
            : _agentClients[agentId];

        uint256 totalScore = 0;
        uint256 matchCount = 0;
        bytes32 tag1Hash = bytes(tag1).length > 0 ? keccak256(bytes(tag1)) : bytes32(0);
        bytes32 tag2Hash = bytes(tag2).length > 0 ? keccak256(bytes(tag2)) : bytes32(0);

        for (uint256 i = 0; i < clients.length; i++) {
            Feedback[] storage clientFeedbacks = _feedbacks[agentId][clients[i]];
            for (uint256 j = 0; j < clientFeedbacks.length; j++) {
                if (clientFeedbacks[j].isRevoked) continue;

                // Check tag filters
                if (tag1Hash != bytes32(0) && keccak256(bytes(clientFeedbacks[j].tag1)) != tag1Hash) continue;
                if (tag2Hash != bytes32(0) && keccak256(bytes(clientFeedbacks[j].tag2)) != tag2Hash) continue;

                totalScore += clientFeedbacks[j].score;
                matchCount++;
            }
        }

        count = uint64(matchCount);
        averageScore = matchCount > 0 ? uint8(totalScore / matchCount) : 0;
    }

    /**
     * @notice Read specific feedback entry
     */
    function readFeedback(
        uint256 agentId,
        address clientAddress,
        uint64 index
    ) external view override returns (
        uint8 score,
        string memory tag1,
        string memory tag2,
        bool isRevoked
    ) {
        Feedback[] storage clientFeedbacks = _feedbacks[agentId][clientAddress];
        require(index < clientFeedbacks.length, "Invalid feedback index");

        Feedback storage fb = clientFeedbacks[index];
        return (fb.score, fb.tag1, fb.tag2, fb.isRevoked);
    }

    /**
     * @notice Read all feedback with filtering
     */
    function readAllFeedback(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2,
        bool includeRevoked
    ) external view override returns (
        address[] memory clients,
        uint8[] memory scores,
        string[] memory tag1s,
        string[] memory tag2s,
        bool[] memory revoked
    ) {
        // Get clients to iterate
        address[] memory targetClients = clientAddresses.length > 0
            ? clientAddresses
            : _agentClients[agentId];

        bytes32 tag1Hash = bytes(tag1).length > 0 ? keccak256(bytes(tag1)) : bytes32(0);
        bytes32 tag2Hash = bytes(tag2).length > 0 ? keccak256(bytes(tag2)) : bytes32(0);

        // First pass: count matching feedbacks
        uint256 matchCount = 0;
        for (uint256 i = 0; i < targetClients.length; i++) {
            Feedback[] storage clientFeedbacks = _feedbacks[agentId][targetClients[i]];
            for (uint256 j = 0; j < clientFeedbacks.length; j++) {
                if (!includeRevoked && clientFeedbacks[j].isRevoked) continue;
                if (tag1Hash != bytes32(0) && keccak256(bytes(clientFeedbacks[j].tag1)) != tag1Hash) continue;
                if (tag2Hash != bytes32(0) && keccak256(bytes(clientFeedbacks[j].tag2)) != tag2Hash) continue;
                matchCount++;
            }
        }

        // Initialize arrays
        clients = new address[](matchCount);
        scores = new uint8[](matchCount);
        tag1s = new string[](matchCount);
        tag2s = new string[](matchCount);
        revoked = new bool[](matchCount);

        // Second pass: populate arrays
        uint256 index = 0;
        for (uint256 i = 0; i < targetClients.length; i++) {
            Feedback[] storage clientFeedbacks = _feedbacks[agentId][targetClients[i]];
            for (uint256 j = 0; j < clientFeedbacks.length; j++) {
                if (!includeRevoked && clientFeedbacks[j].isRevoked) continue;
                if (tag1Hash != bytes32(0) && keccak256(bytes(clientFeedbacks[j].tag1)) != tag1Hash) continue;
                if (tag2Hash != bytes32(0) && keccak256(bytes(clientFeedbacks[j].tag2)) != tag2Hash) continue;

                clients[index] = clientFeedbacks[j].client;
                scores[index] = clientFeedbacks[j].score;
                tag1s[index] = clientFeedbacks[j].tag1;
                tag2s[index] = clientFeedbacks[j].tag2;
                revoked[index] = clientFeedbacks[j].isRevoked;
                index++;
            }
        }
    }

    /**
     * @notice Get all clients who have given feedback to an agent
     */
    function getClients(uint256 agentId) external view override returns (address[] memory) {
        return _agentClients[agentId];
    }

    /**
     * @notice Get the last feedback index for a specific client
     */
    function getLastIndex(
        uint256 agentId,
        address clientAddress
    ) external view override returns (uint64 lastIndex) {
        uint256 length = _feedbacks[agentId][clientAddress].length;
        return length > 0 ? uint64(length - 1) : 0;
    }

    /**
     * @notice Get the Identity Registry address
     */
    function identityRegistry() external view override returns (address) {
        return _identityRegistry;
    }

    // ============ Extended Query Functions (Non-EIP-8004) ============

    /**
     * @notice Get detailed feedback entry (extended version)
     * @param agentId The agent's ID
     * @param clientAddress The client address
     * @param index The feedback index
     * @return feedback Full feedback struct
     */
    function getFeedbackDetails(
        uint256 agentId,
        address clientAddress,
        uint64 index
    ) external view returns (Feedback memory feedback) {
        Feedback[] storage clientFeedbacks = _feedbacks[agentId][clientAddress];
        require(index < clientFeedbacks.length, "Invalid feedback index");
        return clientFeedbacks[index];
    }

    /**
     * @notice Get feedback count for a specific client
     */
    function getClientFeedbackCount(
        uint256 agentId,
        address clientAddress
    ) external view returns (uint256) {
        return _feedbacks[agentId][clientAddress].length;
    }

    // ============ Internal Functions ============

    /**
     * @notice Check if agent exists in Identity Registry
     */
    function _agentExists(uint256 agentId) internal view returns (bool) {
        try IIdentityRegistry(_identityRegistry).ownerOf(agentId) returns (address owner) {
            return owner != address(0);
        } catch {
            return false;
        }
    }

    /**
     * @notice Check if address is the owner of an agent
     */
    function _isAgentOwner(uint256 agentId, address account) internal view returns (bool) {
        try IIdentityRegistry(_identityRegistry).ownerOf(agentId) returns (address owner) {
            return owner == account;
        } catch {
            return false;
        }
    }

    /**
     * @notice Get contract version
     */
    function version() external pure returns (string memory) {
        return "2.0.0";
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
