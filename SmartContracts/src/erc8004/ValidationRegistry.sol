// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./IValidationRegistry.sol";
import "./IIdentityRegistry.sol";

/**
 * @title ValidationRegistry
 * @notice ERC-8004 Validation Registry - Third-party validator attestations
 * @dev Validators stake tokens to provide credible attestations for agents
 *      Attestations have expiration and can be revoked
 */
contract ValidationRegistry is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    IValidationRegistry
{
    /// @notice Reference to the Identity Registry
    address private _identityRegistry;

    /// @notice Minimum stake required for validators
    uint256 private _minimumStake;

    /// @notice Cooldown period for stake withdrawal (in seconds)
    uint256 private _withdrawalCooldown;

    /// @notice Mapping from validator address to Validator struct
    mapping(address => Validator) private _validators;

    /// @notice Mapping from agentId => attestations array
    mapping(uint256 => Attestation[]) private _attestations;

    /// @notice Mapping from agentId => validator => attestation count
    mapping(uint256 => mapping(address => uint256)) private _validatorAttestationCount;

    /// @notice List of all validators
    address[] private _validatorList;

    /// @notice Withdrawal requests (validator => timestamp)
    mapping(address => uint256) private _withdrawalRequests;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     * @param identityRegistry_ Address of the Identity Registry
     * @param minimumStake_ Minimum stake required for validators
     * @param withdrawalCooldown_ Cooldown period for stake withdrawal
     */
    function initialize(
        address identityRegistry_,
        uint256 minimumStake_,
        uint256 withdrawalCooldown_
    ) public initializer {
        require(identityRegistry_ != address(0), "Invalid identity registry");
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        _identityRegistry = identityRegistry_;
        _minimumStake = minimumStake_;
        _withdrawalCooldown = withdrawalCooldown_;
    }

    // ============ Validator Functions ============

    /**
     * @notice Register as a validator with stake
     * @param name Validator name
     * @param metadataURI URI to validator metadata
     */
    function registerValidator(
        string calldata name,
        string calldata metadataURI
    ) external payable override {
        require(!_validators[msg.sender].active, "Already registered");
        require(msg.value >= _minimumStake, "Insufficient stake");
        require(bytes(name).length > 0, "Name required");

        _validators[msg.sender] = Validator({
            name: name,
            metadataURI: metadataURI,
            stake: msg.value,
            registeredAt: block.timestamp,
            active: true,
            attestationCount: 0
        });

        _validatorList.push(msg.sender);
        emit ValidatorRegistered(msg.sender, name, msg.value);
    }

    /**
     * @notice Add more stake
     */
    function updateStake() external payable override {
        require(_validators[msg.sender].active, "Not a validator");
        require(msg.value > 0, "Must send stake");

        uint256 oldStake = _validators[msg.sender].stake;
        _validators[msg.sender].stake += msg.value;

        emit StakeUpdated(msg.sender, oldStake, _validators[msg.sender].stake);
    }

    /**
     * @notice Request stake withdrawal (starts cooldown)
     * @param amount Amount to withdraw
     */
    function withdrawStake(uint256 amount) external override nonReentrant {
        Validator storage validator = _validators[msg.sender];
        require(validator.active || validator.stake > 0, "Not a validator");
        require(amount <= validator.stake, "Insufficient stake");

        // Check if cooldown has passed
        if (_withdrawalRequests[msg.sender] == 0) {
            // Start cooldown
            _withdrawalRequests[msg.sender] = block.timestamp;
            return;
        }

        require(
            block.timestamp >= _withdrawalRequests[msg.sender] + _withdrawalCooldown,
            "Cooldown not complete"
        );

        // Ensure remaining stake meets minimum if still active
        if (validator.active) {
            require(
                validator.stake - amount >= _minimumStake,
                "Would fall below minimum stake"
            );
        }

        uint256 oldStake = validator.stake;
        validator.stake -= amount;
        _withdrawalRequests[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");

        emit StakeUpdated(msg.sender, oldStake, validator.stake);
    }

    /**
     * @notice Deactivate validator
     */
    function deactivateValidator() external override {
        require(_validators[msg.sender].active, "Not active validator");
        _validators[msg.sender].active = false;
        emit ValidatorRemoved(msg.sender);
    }

    /**
     * @notice Get validator information
     * @param validator Validator address
     * @return info Validator struct
     */
    function getValidator(address validator) external view override returns (Validator memory) {
        return _validators[validator];
    }

    /**
     * @notice Check if an address is an active validator
     * @param validator Address to check
     * @return isActive True if active validator
     */
    function isActiveValidator(address validator) external view override returns (bool) {
        return _validators[validator].active && _validators[validator].stake >= _minimumStake;
    }

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
    ) external override returns (uint256 attestationId) {
        require(_validators[msg.sender].active, "Not active validator");
        require(_validators[msg.sender].stake >= _minimumStake, "Insufficient stake");
        require(_agentExists(agentId), "Agent does not exist");
        require(confidenceScore <= 100, "Invalid confidence score");
        require(validityPeriod > 0, "Invalid validity period");

        attestationId = _attestations[agentId].length;

        _attestations[agentId].push(Attestation({
            validator: msg.sender,
            attestationType: attestationType,
            dataHash: dataHash,
            dataURI: dataURI,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + validityPeriod,
            revoked: false,
            confidenceScore: confidenceScore
        }));

        _validators[msg.sender].attestationCount++;
        _validatorAttestationCount[agentId][msg.sender]++;

        emit AttestationCreated(agentId, msg.sender, attestationId, attestationType);
    }

    /**
     * @notice Revoke an attestation
     * @param agentId The agent's ID
     * @param attestationId The attestation ID
     */
    function revokeAttestation(uint256 agentId, uint256 attestationId) external override {
        require(attestationId < _attestations[agentId].length, "Invalid attestation");
        Attestation storage attestation = _attestations[agentId][attestationId];
        require(attestation.validator == msg.sender, "Not attestation creator");
        require(!attestation.revoked, "Already revoked");

        attestation.revoked = true;
        emit AttestationRevoked(agentId, msg.sender, attestationId);
    }

    /**
     * @notice Get attestation details
     * @param agentId The agent's ID
     * @param attestationId The attestation ID
     * @return attestation The attestation struct
     */
    function getAttestation(
        uint256 agentId,
        uint256 attestationId
    ) external view override returns (Attestation memory) {
        require(attestationId < _attestations[agentId].length, "Invalid attestation");
        return _attestations[agentId][attestationId];
    }

    /**
     * @notice Get all attestations for an agent
     * @param agentId The agent's ID
     * @return attestations Array of attestations
     */
    function getAllAttestations(uint256 agentId) external view override returns (Attestation[] memory) {
        return _attestations[agentId];
    }

    /**
     * @notice Get active (non-expired, non-revoked) attestations
     * @param agentId The agent's ID
     * @return Array of active attestations
     */
    function getActiveAttestations(uint256 agentId) external view override returns (Attestation[] memory) {
        Attestation[] storage all = _attestations[agentId];
        uint256 activeCount = 0;

        // Count active attestations
        for (uint256 i = 0; i < all.length; i++) {
            if (!all[i].revoked && all[i].expiresAt > block.timestamp) {
                activeCount++;
            }
        }

        // Build active array
        Attestation[] memory active = new Attestation[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (!all[i].revoked && all[i].expiresAt > block.timestamp) {
                active[index] = all[i];
                index++;
            }
        }

        return active;
    }

    /**
     * @notice Get attestations by type
     * @param agentId The agent's ID
     * @param attestationType Type to filter by
     * @return Array of matching attestations
     */
    function getAttestationsByType(
        uint256 agentId,
        string calldata attestationType
    ) external view override returns (Attestation[] memory) {
        Attestation[] storage all = _attestations[agentId];
        bytes32 typeHash = keccak256(bytes(attestationType));
        uint256 matchCount = 0;

        // Count matches
        for (uint256 i = 0; i < all.length; i++) {
            if (keccak256(bytes(all[i].attestationType)) == typeHash) {
                matchCount++;
            }
        }

        // Build result array
        Attestation[] memory matches = new Attestation[](matchCount);
        uint256 index = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (keccak256(bytes(all[i].attestationType)) == typeHash) {
                matches[index] = all[i];
                index++;
            }
        }

        return matches;
    }

    /**
     * @notice Get validation summary for an agent
     * @param agentId The agent's ID
     * @return summary Validation summary struct
     */
    function getValidationSummary(uint256 agentId) external view override returns (ValidationSummary memory summary) {
        Attestation[] storage all = _attestations[agentId];
        uint256 active = 0;
        uint256 expired = 0;
        uint256 revoked = 0;
        uint256 confidenceSum = 0;
        uint256 validatorCount = 0;

        // Track unique validators
        address[] memory uniqueValidators = new address[](all.length);

        for (uint256 i = 0; i < all.length; i++) {
            if (all[i].revoked) {
                revoked++;
            } else if (all[i].expiresAt <= block.timestamp) {
                expired++;
            } else {
                active++;
                confidenceSum += all[i].confidenceScore;

                // Track unique validator
                bool found = false;
                for (uint256 j = 0; j < validatorCount; j++) {
                    if (uniqueValidators[j] == all[i].validator) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    uniqueValidators[validatorCount] = all[i].validator;
                    validatorCount++;
                }
            }
        }

        summary = ValidationSummary({
            totalAttestations: all.length,
            activeAttestations: active,
            expiredAttestations: expired,
            revokedAttestations: revoked,
            validatorCount: validatorCount,
            averageConfidence: active > 0 ? uint8(confidenceSum / active) : 0,
            lastUpdated: block.timestamp
        });
    }

    /**
     * @notice Check if an agent has a valid attestation of a specific type
     * @param agentId The agent's ID
     * @param attestationType Type to check
     * @return hasValid True if valid attestation exists
     */
    function hasValidAttestation(
        uint256 agentId,
        string calldata attestationType
    ) external view override returns (bool) {
        Attestation[] storage all = _attestations[agentId];
        bytes32 typeHash = keccak256(bytes(attestationType));

        for (uint256 i = 0; i < all.length; i++) {
            if (
                !all[i].revoked &&
                all[i].expiresAt > block.timestamp &&
                keccak256(bytes(all[i].attestationType)) == typeHash
            ) {
                return true;
            }
        }
        return false;
    }

    /**
     * @notice Get the Identity Registry address
     * @return registry The Identity Registry contract address
     */
    function identityRegistry() external view override returns (address) {
        return _identityRegistry;
    }

    /**
     * @notice Get minimum stake required for validators
     * @return minStake Minimum stake amount
     */
    function minimumStake() external view override returns (uint256) {
        return _minimumStake;
    }

    /**
     * @notice Update minimum stake (owner only)
     * @param newMinimum New minimum stake amount
     */
    function setMinimumStake(uint256 newMinimum) external onlyOwner {
        _minimumStake = newMinimum;
    }

    /**
     * @notice Update withdrawal cooldown (owner only)
     * @param newCooldown New cooldown period in seconds
     */
    function setWithdrawalCooldown(uint256 newCooldown) external onlyOwner {
        _withdrawalCooldown = newCooldown;
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
     * @notice Get contract version
     * @return Version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Receive function to accept stake deposits
    receive() external payable {}
}
