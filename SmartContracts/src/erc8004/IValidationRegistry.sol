// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IValidationRegistry
 * @notice ERC-8004 Validation Registry Interface
 * @dev Implements third-party validator attestations for agents
 *      Validators stake tokens and provide cryptographic attestations
 */
interface IValidationRegistry {
    // ============ Events ============

    /// @notice Emitted when a validator is registered
    event ValidatorRegistered(
        address indexed validator,
        string name,
        uint256 stake
    );

    /// @notice Emitted when a validator's stake is updated
    event StakeUpdated(
        address indexed validator,
        uint256 oldStake,
        uint256 newStake
    );

    /// @notice Emitted when a validator is removed
    event ValidatorRemoved(address indexed validator);

    /// @notice Emitted when an attestation is created
    event AttestationCreated(
        uint256 indexed agentId,
        address indexed validator,
        uint256 indexed attestationId,
        string attestationType
    );

    /// @notice Emitted when an attestation is revoked
    event AttestationRevoked(
        uint256 indexed agentId,
        address indexed validator,
        uint256 indexed attestationId
    );

    /// @notice Emitted when an attestation expires
    event AttestationExpired(
        uint256 indexed agentId,
        uint256 indexed attestationId
    );

    // ============ Structs ============

    /// @notice Validator information
    struct Validator {
        string name;
        string metadataURI;      // Validator's info/capabilities
        uint256 stake;           // Staked amount for credibility
        uint256 registeredAt;
        bool active;
        uint256 attestationCount;
    }

    /// @notice Attestation entry
    struct Attestation {
        address validator;
        string attestationType;   // e.g., "security-audit", "performance-verified"
        bytes32 dataHash;         // Hash of attestation data
        string dataURI;           // URI to attestation details
        uint256 createdAt;
        uint256 expiresAt;
        bool revoked;
        uint8 confidenceScore;    // 0-100 confidence level
    }

    /// @notice Validation summary for an agent
    struct ValidationSummary {
        uint256 totalAttestations;
        uint256 activeAttestations;
        uint256 expiredAttestations;
        uint256 revokedAttestations;
        uint256 validatorCount;
        uint8 averageConfidence;
        uint256 lastUpdated;
    }

    // ============ Validator Functions ============

    /**
     * @notice Register as a validator
     * @param name Validator name
     * @param metadataURI URI to validator metadata
     */
    function registerValidator(
        string calldata name,
        string calldata metadataURI
    ) external payable;

    /**
     * @notice Update validator stake
     */
    function updateStake() external payable;

    /**
     * @notice Withdraw stake (after cooldown period)
     * @param amount Amount to withdraw
     */
    function withdrawStake(uint256 amount) external;

    /**
     * @notice Deactivate validator (must wait for attestations to expire)
     */
    function deactivateValidator() external;

    /**
     * @notice Get validator information
     * @param validator Validator address
     * @return info Validator struct
     */
    function getValidator(address validator) external view returns (Validator memory info);

    /**
     * @notice Check if an address is an active validator
     * @param validator Address to check
     * @return isActive True if active validator
     */
    function isActiveValidator(address validator) external view returns (bool isActive);

    // ============ Attestation Functions ============

    /**
     * @notice Create an attestation for an agent
     * @param agentId The agent's ID
     * @param attestationType Type of attestation
     * @param dataHash Hash of attestation data
     * @param dataURI URI to attestation details
     * @param validityPeriod How long the attestation is valid (seconds)
     * @param confidenceScore Confidence level (0-100)
     * @return attestationId The attestation ID
     */
    function attest(
        uint256 agentId,
        string calldata attestationType,
        bytes32 dataHash,
        string calldata dataURI,
        uint256 validityPeriod,
        uint8 confidenceScore
    ) external returns (uint256 attestationId);

    /**
     * @notice Revoke an attestation
     * @param agentId The agent's ID
     * @param attestationId The attestation ID
     */
    function revokeAttestation(uint256 agentId, uint256 attestationId) external;

    /**
     * @notice Get attestation details
     * @param agentId The agent's ID
     * @param attestationId The attestation ID
     * @return attestation The attestation struct
     */
    function getAttestation(
        uint256 agentId,
        uint256 attestationId
    ) external view returns (Attestation memory attestation);

    /**
     * @notice Get all attestations for an agent
     * @param agentId The agent's ID
     * @return attestations Array of attestations
     */
    function getAllAttestations(uint256 agentId) external view returns (Attestation[] memory attestations);

    /**
     * @notice Get active (non-expired, non-revoked) attestations
     * @param agentId The agent's ID
     * @return attestations Array of active attestations
     */
    function getActiveAttestations(uint256 agentId) external view returns (Attestation[] memory attestations);

    /**
     * @notice Get attestations by type
     * @param agentId The agent's ID
     * @param attestationType Type to filter by
     * @return attestations Array of matching attestations
     */
    function getAttestationsByType(
        uint256 agentId,
        string calldata attestationType
    ) external view returns (Attestation[] memory attestations);

    /**
     * @notice Get validation summary for an agent
     * @param agentId The agent's ID
     * @return summary Validation summary struct
     */
    function getValidationSummary(uint256 agentId) external view returns (ValidationSummary memory summary);

    /**
     * @notice Check if an agent has a valid attestation of a specific type
     * @param agentId The agent's ID
     * @param attestationType Type to check
     * @return hasValid True if valid attestation exists
     */
    function hasValidAttestation(
        uint256 agentId,
        string calldata attestationType
    ) external view returns (bool hasValid);

    /**
     * @notice Get the Identity Registry address
     * @return registry The Identity Registry contract address
     */
    function identityRegistry() external view returns (address registry);

    /**
     * @notice Get minimum stake required for validators
     * @return minStake Minimum stake amount
     */
    function minimumStake() external view returns (uint256 minStake);
}
