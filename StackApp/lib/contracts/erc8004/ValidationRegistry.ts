/**
 * ERC-8004 Validation Registry ABI
 * Minimal ABI for frontend interactions
 */
export const VALIDATION_REGISTRY_ABI = [
  // Read functions
  {
    inputs: [{ name: "validator", type: "address" }],
    name: "getValidator",
    outputs: [
      {
        name: "info",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "metadataURI", type: "string" },
          { name: "stake", type: "uint256" },
          { name: "registeredAt", type: "uint256" },
          { name: "active", type: "bool" },
          { name: "attestationCount", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "validator", type: "address" }],
    name: "isActiveValidator",
    outputs: [{ name: "isActive", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "attestationId", type: "uint256" },
    ],
    name: "getAttestation",
    outputs: [
      {
        name: "attestation",
        type: "tuple",
        components: [
          { name: "validator", type: "address" },
          { name: "attestationType", type: "string" },
          { name: "dataHash", type: "bytes32" },
          { name: "dataURI", type: "string" },
          { name: "createdAt", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
          { name: "revoked", type: "bool" },
          { name: "confidenceScore", type: "uint8" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "getAllAttestations",
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "validator", type: "address" },
          { name: "attestationType", type: "string" },
          { name: "dataHash", type: "bytes32" },
          { name: "dataURI", type: "string" },
          { name: "createdAt", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
          { name: "revoked", type: "bool" },
          { name: "confidenceScore", type: "uint8" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "getActiveAttestations",
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "validator", type: "address" },
          { name: "attestationType", type: "string" },
          { name: "dataHash", type: "bytes32" },
          { name: "dataURI", type: "string" },
          { name: "createdAt", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
          { name: "revoked", type: "bool" },
          { name: "confidenceScore", type: "uint8" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "attestationType", type: "string" },
    ],
    name: "getAttestationsByType",
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "validator", type: "address" },
          { name: "attestationType", type: "string" },
          { name: "dataHash", type: "bytes32" },
          { name: "dataURI", type: "string" },
          { name: "createdAt", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
          { name: "revoked", type: "bool" },
          { name: "confidenceScore", type: "uint8" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "getValidationSummary",
    outputs: [
      {
        name: "summary",
        type: "tuple",
        components: [
          { name: "totalAttestations", type: "uint256" },
          { name: "activeAttestations", type: "uint256" },
          { name: "expiredAttestations", type: "uint256" },
          { name: "revokedAttestations", type: "uint256" },
          { name: "validatorCount", type: "uint256" },
          { name: "averageConfidence", type: "uint8" },
          { name: "lastUpdated", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "attestationType", type: "string" },
    ],
    name: "hasValidAttestation",
    outputs: [{ name: "hasValid", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "identityRegistry",
    outputs: [{ name: "registry", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "minimumStake",
    outputs: [{ name: "minStake", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "version",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "pure",
    type: "function",
  },

  // Write functions
  {
    inputs: [
      { name: "name", type: "string" },
      { name: "metadataURI", type: "string" },
    ],
    name: "registerValidator",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "updateStake",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "withdrawStake",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "deactivateValidator",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "attestationType", type: "string" },
      { name: "dataHash", type: "bytes32" },
      { name: "dataURI", type: "string" },
      { name: "validityPeriod", type: "uint256" },
      { name: "confidenceScore", type: "uint8" },
    ],
    name: "attest",
    outputs: [{ name: "attestationId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "attestationId", type: "uint256" },
    ],
    name: "revokeAttestation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "validator", type: "address" },
      { indexed: false, name: "name", type: "string" },
      { indexed: false, name: "stake", type: "uint256" },
    ],
    name: "ValidatorRegistered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "validator", type: "address" },
      { indexed: false, name: "oldStake", type: "uint256" },
      { indexed: false, name: "newStake", type: "uint256" },
    ],
    name: "StakeUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: "validator", type: "address" }],
    name: "ValidatorRemoved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: true, name: "validator", type: "address" },
      { indexed: true, name: "attestationId", type: "uint256" },
      { indexed: false, name: "attestationType", type: "string" },
    ],
    name: "AttestationCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: true, name: "validator", type: "address" },
      { indexed: true, name: "attestationId", type: "uint256" },
    ],
    name: "AttestationRevoked",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: true, name: "attestationId", type: "uint256" },
    ],
    name: "AttestationExpired",
    type: "event",
  },
] as const;
