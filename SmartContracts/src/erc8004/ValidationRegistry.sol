// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./IValidationRegistry.sol";
import "./IIdentityRegistry.sol";

/**
 * @title ValidationRegistry
 * @notice ERC-8004 Validation Registry - Request-response validation model
 * @dev Implements standardized validation request/response per EIP-8004:
 *      - Anyone can request validation from any validator address
 *      - Validators respond with score (0-100) and categorization tag
 *      - Filtering by validator addresses and tags
 *      - Tracking by requestHash for unique identification
 */
contract ValidationRegistry is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    IValidationRegistry
{
    /// @notice Reference to the Identity Registry
    address private _identityRegistry;

    /// @notice Mapping from requestHash => ValidationRequest
    mapping(bytes32 => ValidationRequest) private _validations;

    /// @notice Mapping from agentId => array of request hashes
    mapping(uint256 => bytes32[]) private _agentValidations;

    /// @notice Mapping from validator address => array of request hashes
    mapping(address => bytes32[]) private _validatorRequests;

    /// @notice Counter for generating unique request IDs
    uint256 private _requestCounter;

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
        _requestCounter = 0;
    }

    // ============ Request Functions (EIP-8004 Compliant) ============

    /**
     * @notice Request validation from a specific validator
     * @param validatorAddress Address of the validator to request
     * @param agentId The agent's ID in the Identity Registry
     * @param requestURI URI to validation request details
     * @param requestDataHash Hash of request data for verification
     * @return requestHash Unique identifier for this validation request
     */
    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestDataHash
    ) external override returns (bytes32 requestHash) {
        require(validatorAddress != address(0), "Invalid validator address");
        require(_agentExists(agentId), "Agent does not exist");

        // Generate unique request hash
        _requestCounter++;
        requestHash = keccak256(abi.encodePacked(
            agentId,
            validatorAddress,
            msg.sender,
            block.timestamp,
            _requestCounter
        ));

        // Ensure uniqueness (should always be unique due to counter)
        require(_validations[requestHash].requestedAt == 0, "Request already exists");

        // Create validation request
        _validations[requestHash] = ValidationRequest({
            agentId: agentId,
            requester: msg.sender,
            validatorAddress: validatorAddress,
            requestURI: requestURI,
            requestDataHash: requestDataHash,
            requestedAt: block.timestamp,
            status: ValidationStatus.Pending,
            response: 0,
            responseURI: "",
            responseDataHash: bytes32(0),
            tag: "",
            respondedAt: 0
        });

        // Track request for agent and validator
        _agentValidations[agentId].push(requestHash);
        _validatorRequests[validatorAddress].push(requestHash);

        emit ValidationRequested(requestHash, agentId, validatorAddress, requestURI, requestDataHash);
    }

    /**
     * @notice Respond to a validation request (validator only)
     * @param requestHash The unique request identifier
     * @param response Response score from 0 to 100
     * @param responseURI URI to detailed response
     * @param responseDataHash Hash of response data
     * @param tag Categorization tag
     */
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseDataHash,
        string calldata tag
    ) external override {
        ValidationRequest storage request = _validations[requestHash];

        require(request.requestedAt > 0, "Request does not exist");
        require(request.status == ValidationStatus.Pending, "Request not pending");
        require(request.validatorAddress == msg.sender, "Not the assigned validator");
        require(response <= 100, "Response must be 0-100");

        // Update request with response
        request.response = response;
        request.responseURI = responseURI;
        request.responseDataHash = responseDataHash;
        request.tag = tag;
        request.respondedAt = block.timestamp;

        // Set status based on response score (>50 = approved)
        request.status = response > 50 ? ValidationStatus.Approved : ValidationStatus.Rejected;

        emit ValidationResponseSubmitted(requestHash, request.agentId, msg.sender, response, tag);
    }

    /**
     * @notice Cancel a pending validation request
     * @param requestHash The unique request identifier
     */
    function cancelValidation(bytes32 requestHash) external override {
        ValidationRequest storage request = _validations[requestHash];

        require(request.requestedAt > 0, "Request does not exist");
        require(request.status == ValidationStatus.Pending, "Request not pending");

        // Only requester or agent owner can cancel
        bool isRequester = request.requester == msg.sender;
        bool isAgentOwner = _isAgentOwner(request.agentId, msg.sender);
        require(isRequester || isAgentOwner, "Not authorized to cancel");

        request.status = ValidationStatus.Cancelled;

        emit ValidationCancelled(requestHash, request.agentId, msg.sender);
    }

    // ============ Query Functions (EIP-8004 Compliant) ============

    /**
     * @notice Get the status and key details of a validation request
     */
    function getValidationStatus(
        bytes32 requestHash
    ) external view override returns (
        ValidationStatus status,
        uint256 agentId,
        address validatorAddress,
        uint8 response,
        string memory tag
    ) {
        ValidationRequest storage request = _validations[requestHash];
        return (
            request.status,
            request.agentId,
            request.validatorAddress,
            request.response,
            request.tag
        );
    }

    /**
     * @notice Get full validation request details
     */
    function getValidation(
        bytes32 requestHash
    ) external view override returns (ValidationRequest memory request) {
        return _validations[requestHash];
    }

    /**
     * @notice Get validation summary with filtering
     */
    function getSummary(
        uint256 agentId,
        address[] calldata validatorAddresses,
        string calldata tag
    ) external view override returns (uint64 count, uint8 averageResponse) {
        bytes32[] storage requestHashes = _agentValidations[agentId];

        uint256 totalResponse = 0;
        uint256 matchCount = 0;
        bytes32 tagHash = bytes(tag).length > 0 ? keccak256(bytes(tag)) : bytes32(0);

        for (uint256 i = 0; i < requestHashes.length; i++) {
            ValidationRequest storage request = _validations[requestHashes[i]];

            // Skip if not completed (approved or rejected)
            if (request.status != ValidationStatus.Approved &&
                request.status != ValidationStatus.Rejected) {
                continue;
            }

            // Check validator filter
            if (validatorAddresses.length > 0) {
                bool validatorMatch = false;
                for (uint256 j = 0; j < validatorAddresses.length; j++) {
                    if (request.validatorAddress == validatorAddresses[j]) {
                        validatorMatch = true;
                        break;
                    }
                }
                if (!validatorMatch) continue;
            }

            // Check tag filter
            if (tagHash != bytes32(0) && keccak256(bytes(request.tag)) != tagHash) {
                continue;
            }

            totalResponse += request.response;
            matchCount++;
        }

        count = uint64(matchCount);
        averageResponse = matchCount > 0 ? uint8(totalResponse / matchCount) : 0;
    }

    /**
     * @notice Get all validation request hashes for an agent
     */
    function getAgentValidations(
        uint256 agentId
    ) external view override returns (bytes32[] memory requestHashes) {
        return _agentValidations[agentId];
    }

    /**
     * @notice Get all validation request hashes assigned to a validator
     */
    function getValidatorRequests(
        address validatorAddress
    ) external view override returns (bytes32[] memory requestHashes) {
        return _validatorRequests[validatorAddress];
    }

    /**
     * @notice Check if an agent has an approved validation with specific tag
     */
    function hasApprovedValidation(
        uint256 agentId,
        string calldata tag
    ) external view override returns (bool hasApproval) {
        bytes32[] storage requestHashes = _agentValidations[agentId];
        bytes32 tagHash = bytes(tag).length > 0 ? keccak256(bytes(tag)) : bytes32(0);

        for (uint256 i = 0; i < requestHashes.length; i++) {
            ValidationRequest storage request = _validations[requestHashes[i]];

            if (request.status != ValidationStatus.Approved) {
                continue;
            }

            // If no tag filter, any approved validation counts
            if (tagHash == bytes32(0)) {
                return true;
            }

            // Check tag match
            if (keccak256(bytes(request.tag)) == tagHash) {
                return true;
            }
        }

        return false;
    }

    /**
     * @notice Get the Identity Registry address
     */
    function identityRegistry() external view override returns (address) {
        return _identityRegistry;
    }

    // ============ Extended Query Functions (Non-EIP-8004) ============

    /**
     * @notice Get pending validation requests for a validator
     * @param validatorAddress The validator's address
     * @return requestHashes Array of pending request hashes
     */
    function getPendingRequests(
        address validatorAddress
    ) external view returns (bytes32[] memory) {
        bytes32[] storage allRequests = _validatorRequests[validatorAddress];

        // Count pending requests
        uint256 pendingCount = 0;
        for (uint256 i = 0; i < allRequests.length; i++) {
            if (_validations[allRequests[i]].status == ValidationStatus.Pending) {
                pendingCount++;
            }
        }

        // Build pending array
        bytes32[] memory pending = new bytes32[](pendingCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allRequests.length; i++) {
            if (_validations[allRequests[i]].status == ValidationStatus.Pending) {
                pending[index] = allRequests[i];
                index++;
            }
        }

        return pending;
    }

    /**
     * @notice Get validation statistics for an agent
     * @param agentId The agent's ID
     * @return summary Detailed validation summary
     */
    function getValidationStatistics(
        uint256 agentId
    ) external view returns (ValidationSummary memory summary) {
        bytes32[] storage requestHashes = _agentValidations[agentId];

        uint64 totalRequests = uint64(requestHashes.length);
        uint64 approvedCount = 0;
        uint64 rejectedCount = 0;
        uint64 pendingCount = 0;
        uint256 totalResponse = 0;
        uint256 respondedCount = 0;

        for (uint256 i = 0; i < requestHashes.length; i++) {
            ValidationRequest storage request = _validations[requestHashes[i]];

            if (request.status == ValidationStatus.Approved) {
                approvedCount++;
                totalResponse += request.response;
                respondedCount++;
            } else if (request.status == ValidationStatus.Rejected) {
                rejectedCount++;
                totalResponse += request.response;
                respondedCount++;
            } else if (request.status == ValidationStatus.Pending) {
                pendingCount++;
            }
            // Cancelled requests are not counted
        }

        summary = ValidationSummary({
            totalRequests: totalRequests,
            approvedCount: approvedCount,
            rejectedCount: rejectedCount,
            pendingCount: pendingCount,
            averageResponse: respondedCount > 0 ? uint8(totalResponse / respondedCount) : 0
        });
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
