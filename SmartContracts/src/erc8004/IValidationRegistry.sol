// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IValidationRegistry
 * @notice ERC-8004 Validation Registry Interface
 * @dev Request-response validation model for third-party attestations
 *
 * Key Features:
 * - Agents request validation from specific validators
 * - Validators respond with score (0-100) and optional metadata
 * - Filtering by validator addresses and tags
 * - Tracking by requestHash for unique identification
 */
interface IValidationRegistry {
    // ============ Events (EIP-8004 Compliant) ============

    /// @notice Emitted when a validation is requested
    event ValidationRequested(
        bytes32 indexed requestHash,
        uint256 indexed agentId,
        address indexed validatorAddress,
        string requestURI,
        bytes32 requestDataHash
    );

    /// @notice Emitted when a validator responds to a request
    event ValidationResponseSubmitted(
        bytes32 indexed requestHash,
        uint256 indexed agentId,
        address indexed validatorAddress,
        uint8 response,
        string tag
    );

    /// @notice Emitted when a validation request is cancelled
    event ValidationCancelled(
        bytes32 indexed requestHash,
        uint256 indexed agentId,
        address indexed cancelledBy
    );

    // ============ Enums ============

    /// @notice Status of a validation request
    enum ValidationStatus {
        None,       // No request exists
        Pending,    // Request submitted, awaiting response
        Approved,   // Validator approved (response > 50)
        Rejected,   // Validator rejected (response <= 50)
        Cancelled   // Request was cancelled
    }

    // ============ Structs (EIP-8004 Compliant) ============

    /// @notice Validation request structure
    struct ValidationRequest {
        uint256 agentId;
        address requester;
        address validatorAddress;
        string requestURI;
        bytes32 requestDataHash;
        uint256 requestedAt;
        ValidationStatus status;
        uint8 response;           // 0-100 scale
        string responseURI;
        bytes32 responseDataHash;
        string tag;
        uint256 respondedAt;
    }

    /// @notice Aggregated validation summary
    struct ValidationSummary {
        uint64 totalRequests;
        uint64 approvedCount;
        uint64 rejectedCount;
        uint64 pendingCount;
        uint8 averageResponse;    // 0-100
    }

    // ============ Request Functions (EIP-8004 Compliant) ============

    /**
     * @notice Request validation from a specific validator
     * @param validatorAddress Address of the validator to request
     * @param agentId The agent's ID in the Identity Registry
     * @param requestURI URI to validation request details (optional)
     * @param requestDataHash Hash of request data for verification (optional)
     * @return requestHash Unique identifier for this validation request
     */
    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestDataHash
    ) external returns (bytes32 requestHash);

    /**
     * @notice Respond to a validation request (validator only)
     * @param requestHash The unique request identifier
     * @param response Response score from 0 to 100 (0 = reject, 100 = full approval)
     * @param responseURI URI to detailed response (optional)
     * @param responseDataHash Hash of response data (optional)
     * @param tag Categorization tag (e.g., "security", "compliance", "performance")
     */
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseDataHash,
        string calldata tag
    ) external;

    /**
     * @notice Cancel a pending validation request (requester or agent owner only)
     * @param requestHash The unique request identifier
     */
    function cancelValidation(bytes32 requestHash) external;

    // ============ Query Functions (EIP-8004 Compliant) ============

    /**
     * @notice Get the status and details of a validation request
     * @param requestHash The unique request identifier
     * @return status Current validation status
     * @return agentId The agent's ID
     * @return validatorAddress The validator's address
     * @return response The response score (0-100, only valid if status is Approved/Rejected)
     * @return tag The categorization tag
     */
    function getValidationStatus(
        bytes32 requestHash
    ) external view returns (
        ValidationStatus status,
        uint256 agentId,
        address validatorAddress,
        uint8 response,
        string memory tag
    );

    /**
     * @notice Get full validation request details
     * @param requestHash The unique request identifier
     * @return request Full ValidationRequest struct
     */
    function getValidation(
        bytes32 requestHash
    ) external view returns (ValidationRequest memory request);

    /**
     * @notice Get validation summary with filtering
     * @param agentId The agent's ID
     * @param validatorAddresses Filter by specific validators (empty = all)
     * @param tag Filter by tag (empty = all)
     * @return count Number of matching completed validations
     * @return averageResponse Average response score of matching validations
     */
    function getSummary(
        uint256 agentId,
        address[] calldata validatorAddresses,
        string calldata tag
    ) external view returns (uint64 count, uint8 averageResponse);

    /**
     * @notice Get all validation request hashes for an agent
     * @param agentId The agent's ID
     * @return requestHashes Array of request hashes
     */
    function getAgentValidations(
        uint256 agentId
    ) external view returns (bytes32[] memory requestHashes);

    /**
     * @notice Get all validation request hashes assigned to a validator
     * @param validatorAddress The validator's address
     * @return requestHashes Array of request hashes
     */
    function getValidatorRequests(
        address validatorAddress
    ) external view returns (bytes32[] memory requestHashes);

    /**
     * @notice Check if an agent has an approved validation with specific tag
     * @param agentId The agent's ID
     * @param tag Tag to check (empty = any tag)
     * @return hasApproval True if approved validation exists
     */
    function hasApprovedValidation(
        uint256 agentId,
        string calldata tag
    ) external view returns (bool hasApproval);

    /**
     * @notice Get the Identity Registry address
     * @return registry The Identity Registry contract address
     */
    function identityRegistry() external view returns (address registry);
}
