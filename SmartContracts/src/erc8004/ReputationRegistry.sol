// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "./IReputationRegistry.sol";
import "./IIdentityRegistry.sol";

/**
 * @title ReputationRegistry
 * @notice ERC-8004 Reputation Registry - On-chain feedback system
 * @dev Implements cryptographically signed feedback with EIP-712
 *      Feedback can be given, revoked, and responded to by agents
 */
contract ReputationRegistry is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    EIP712Upgradeable,
    IReputationRegistry
{
    using ECDSAUpgradeable for bytes32;

    /// @notice Reference to the Identity Registry
    address private _identityRegistry;

    /// @notice Mapping from agentId => feedbacks array
    mapping(uint256 => Feedback[]) private _feedbacks;

    /// @notice Mapping from agentId => client => has given feedback
    mapping(uint256 => mapping(address => bool)) private _hasClientFeedback;

    /// @notice Mapping from agentId => clients array
    mapping(uint256 => address[]) private _agentClients;

    /// @notice Mapping for nonce tracking (client => nonce => used)
    mapping(address => mapping(uint256 => bool)) private _usedNonces;

    /// @notice EIP-712 typehash for FeedbackAuth
    bytes32 private constant FEEDBACK_AUTH_TYPEHASH =
        keccak256("FeedbackAuth(uint256 agentId,address client,uint256 nonce,uint256 deadline)");

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
        __EIP712_init("ERC8004ReputationRegistry", "1");
        _identityRegistry = identityRegistry_;
    }

    /**
     * @notice Give feedback with signature authorization
     * @param agentId The agent's ID
     * @param rating Rating from -100 to +100
     * @param comment Feedback comment
     * @param auth Authorization structure
     * @param signature Client's signature
     * @return index The feedback index
     */
    function giveFeedback(
        uint256 agentId,
        int8 rating,
        string calldata comment,
        FeedbackAuth calldata auth,
        bytes calldata signature
    ) external override returns (uint256 index) {
        // Verify auth parameters
        require(auth.agentId == agentId, "Agent ID mismatch");
        require(auth.deadline >= block.timestamp, "Authorization expired");
        require(!_usedNonces[auth.client][auth.nonce], "Nonce already used");

        // Verify signature
        bytes32 structHash = keccak256(abi.encode(
            FEEDBACK_AUTH_TYPEHASH,
            auth.agentId,
            auth.client,
            auth.nonce,
            auth.deadline
        ));
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(signature);
        require(signer == auth.client, "Invalid signature");

        // Mark nonce as used
        _usedNonces[auth.client][auth.nonce] = true;

        // Give feedback
        return _giveFeedback(agentId, auth.client, rating, comment);
    }

    /**
     * @notice Give feedback directly (msg.sender is client)
     * @param agentId The agent's ID
     * @param rating Rating from -100 to +100
     * @param comment Feedback comment
     * @return index The feedback index
     */
    function giveFeedback(
        uint256 agentId,
        int8 rating,
        string calldata comment
    ) external override returns (uint256 index) {
        return _giveFeedback(agentId, msg.sender, rating, comment);
    }

    /**
     * @dev Internal function to give feedback
     */
    function _giveFeedback(
        uint256 agentId,
        address client,
        int8 rating,
        string calldata comment
    ) internal returns (uint256 index) {
        // Verify agent exists in Identity Registry
        require(_agentExists(agentId), "Agent does not exist");
        require(rating >= -100 && rating <= 100, "Rating out of range");

        // Track client
        if (!_hasClientFeedback[agentId][client]) {
            _hasClientFeedback[agentId][client] = true;
            _agentClients[agentId].push(client);
        }

        // Create feedback entry
        index = _feedbacks[agentId].length;
        _feedbacks[agentId].push(Feedback({
            client: client,
            rating: rating,
            comment: comment,
            timestamp: block.timestamp,
            revoked: false,
            response: ""
        }));

        emit FeedbackGiven(agentId, client, index, rating, comment);
    }

    /**
     * @notice Revoke previously given feedback
     * @param agentId The agent's ID
     * @param index The feedback index to revoke
     */
    function revokeFeedback(uint256 agentId, uint256 index) external override {
        require(index < _feedbacks[agentId].length, "Invalid feedback index");
        Feedback storage feedback = _feedbacks[agentId][index];
        require(feedback.client == msg.sender, "Not feedback owner");
        require(!feedback.revoked, "Already revoked");

        feedback.revoked = true;
        emit FeedbackRevoked(agentId, msg.sender, index);
    }

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
    ) external override {
        require(index < _feedbacks[agentId].length, "Invalid feedback index");
        require(_isAgentOwner(agentId, msg.sender), "Not agent owner");

        Feedback storage feedback = _feedbacks[agentId][index];
        require(!feedback.revoked, "Feedback was revoked");
        require(bytes(feedback.response).length == 0, "Response already exists");

        feedback.response = response;
        emit ResponseAppended(agentId, index, response);
    }

    /**
     * @notice Get reputation summary for an agent
     * @param agentId The agent's ID
     * @return summary Aggregated reputation data
     */
    function getSummary(uint256 agentId) external view override returns (ReputationSummary memory summary) {
        Feedback[] storage feedbacks = _feedbacks[agentId];
        uint256 total = feedbacks.length;
        uint256 active = 0;
        int256 ratingSum = 0;
        uint256 positive = 0;
        uint256 negative = 0;
        uint256 neutral = 0;

        for (uint256 i = 0; i < total; i++) {
            if (!feedbacks[i].revoked) {
                active++;
                ratingSum += int256(feedbacks[i].rating);

                if (feedbacks[i].rating > 0) {
                    positive++;
                } else if (feedbacks[i].rating < 0) {
                    negative++;
                } else {
                    neutral++;
                }
            }
        }

        summary = ReputationSummary({
            totalFeedback: total,
            activeFeedback: active,
            averageRating: active > 0 ? (ratingSum * 100) / int256(active) : int256(0),
            positiveCount: positive,
            negativeCount: negative,
            neutralCount: neutral,
            lastUpdated: block.timestamp
        });
    }

    /**
     * @notice Read specific feedback entry
     * @param agentId The agent's ID
     * @param index The feedback index
     * @return feedback The feedback entry
     */
    function readFeedback(uint256 agentId, uint256 index) external view override returns (Feedback memory feedback) {
        require(index < _feedbacks[agentId].length, "Invalid feedback index");
        return _feedbacks[agentId][index];
    }

    /**
     * @notice Read all feedback for an agent
     * @param agentId The agent's ID
     * @return feedbacks Array of all feedback entries
     */
    function readAllFeedback(uint256 agentId) external view override returns (Feedback[] memory) {
        return _feedbacks[agentId];
    }

    /**
     * @notice Get the last feedback index for an agent
     * @param agentId The agent's ID
     * @return lastIndex The last index (or 0 if no feedback)
     */
    function getLastIndex(uint256 agentId) external view override returns (uint256 lastIndex) {
        uint256 length = _feedbacks[agentId].length;
        return length > 0 ? length - 1 : 0;
    }

    /**
     * @notice Get all clients who have given feedback to an agent
     * @param agentId The agent's ID
     * @return clients Array of client addresses
     */
    function getClients(uint256 agentId) external view override returns (address[] memory) {
        return _agentClients[agentId];
    }

    /**
     * @notice Check if a client has given feedback to an agent
     * @param agentId The agent's ID
     * @param client The client address
     * @return hasFeedback True if client has given feedback
     */
    function hasClientFeedback(uint256 agentId, address client) external view override returns (bool) {
        return _hasClientFeedback[agentId][client];
    }

    /**
     * @notice Get the Identity Registry address
     * @return registry The Identity Registry contract address
     */
    function identityRegistry() external view override returns (address) {
        return _identityRegistry;
    }

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
     * @return Version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
