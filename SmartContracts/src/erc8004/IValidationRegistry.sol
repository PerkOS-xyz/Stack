// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IValidationRegistry
 * @notice ERC-8004 Validation Registry Interface (v2)
 * @dev v2 changes:
 *      - Removed ValidationStatus enum
 *      - validationResponse() can be called multiple times (progressive validation)
 *      - getValidationStatus returns (validatorAddress, agentId, response, responseHash, tag, lastUpdate)
 *      - Removed cancelValidation, hasApprovedValidation, getValidationStatistics
 */
interface IValidationRegistry {
    // ============ Events ============

    /// @notice Emitted when a validation is requested
    event ValidationRequested(
        bytes32 indexed requestHash,
        uint256 indexed agentId,
        address indexed validatorAddress,
        string requestURI,
        bytes32 requestDataHash
    );

    /// @notice Emitted when a validator responds (can fire multiple times per request)
    event ValidationResponseSubmitted(
        bytes32 indexed requestHash,
        uint256 indexed agentId,
        address indexed validatorAddress,
        uint8 response,
        string tag
    );

    // ============ Request Functions ============

    /**
     * @notice Request validation from a specific validator
     * @param validatorAddress Address of the validator
     * @param agentId The agent's ID
     * @param requestURI URI to request details (optional)
     * @param requestDataHash Hash of request data (optional)
     * @return requestHash Unique identifier for this request
     */
    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestDataHash
    ) external returns (bytes32 requestHash);

    /**
     * @notice Respond to a validation request (progressive — can be called multiple times)
     * @param requestHash The unique request identifier
     * @param response Response score 0-100
     * @param responseURI URI to detailed response (optional)
     * @param responseDataHash Hash of response data (optional)
     * @param tag Categorization tag
     */
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseDataHash,
        string calldata tag
    ) external;

    // ============ Query Functions ============

    /**
     * @notice Get validation status (v2: includes responseHash and lastUpdate)
     * @param requestHash The unique request identifier
     * @return validatorAddress The validator's address
     * @return agentId The agent's ID
     * @return response The response score (0-100)
     * @return responseHash Hash of the response data
     * @return tag The categorization tag
     * @return lastUpdate Timestamp of last response update
     */
    function getValidationStatus(
        bytes32 requestHash
    ) external view returns (
        address validatorAddress,
        uint256 agentId,
        uint8 response,
        bytes32 responseHash,
        string memory tag,
        uint256 lastUpdate
    );

    /**
     * @notice Get validation summary with filtering
     * @param agentId The agent's ID
     * @param validatorAddresses Filter by validators (empty = all)
     * @param tag Filter by tag (empty = all)
     * @return count Number of completed validations
     * @return averageResponse Average response score
     */
    function getSummary(
        uint256 agentId,
        address[] calldata validatorAddresses,
        string calldata tag
    ) external view returns (uint64 count, uint8 averageResponse);

    /**
     * @notice Get all validation request hashes for an agent
     */
    function getAgentValidations(
        uint256 agentId
    ) external view returns (bytes32[] memory requestHashes);

    /**
     * @notice Get all validation request hashes for a validator
     */
    function getValidatorRequests(
        address validatorAddress
    ) external view returns (bytes32[] memory requestHashes);

    /**
     * @notice Get the Identity Registry address
     */
    function identityRegistry() external view returns (address registry);
}
