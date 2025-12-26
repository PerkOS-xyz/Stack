/**
 * ERC-8004 Reputation Registry ABI
 * Minimal ABI for frontend interactions
 */
export const REPUTATION_REGISTRY_ABI = [
  // Read functions
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "getSummary",
    outputs: [
      {
        name: "summary",
        type: "tuple",
        components: [
          { name: "totalFeedback", type: "uint256" },
          { name: "activeFeedback", type: "uint256" },
          { name: "averageRating", type: "int256" },
          { name: "positiveCount", type: "uint256" },
          { name: "negativeCount", type: "uint256" },
          { name: "neutralCount", type: "uint256" },
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
      { name: "index", type: "uint256" },
    ],
    name: "readFeedback",
    outputs: [
      {
        name: "feedback",
        type: "tuple",
        components: [
          { name: "client", type: "address" },
          { name: "rating", type: "int8" },
          { name: "comment", type: "string" },
          { name: "timestamp", type: "uint256" },
          { name: "revoked", type: "bool" },
          { name: "response", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "readAllFeedback",
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "client", type: "address" },
          { name: "rating", type: "int8" },
          { name: "comment", type: "string" },
          { name: "timestamp", type: "uint256" },
          { name: "revoked", type: "bool" },
          { name: "response", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "getLastIndex",
    outputs: [{ name: "lastIndex", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "getClients",
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "client", type: "address" },
    ],
    name: "hasClientFeedback",
    outputs: [{ name: "hasFeedback", type: "bool" }],
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
    name: "version",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "pure",
    type: "function",
  },

  // Write functions
  {
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "rating", type: "int8" },
      { name: "comment", type: "string" },
      {
        name: "auth",
        type: "tuple",
        components: [
          { name: "agentId", type: "uint256" },
          { name: "client", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    name: "giveFeedback",
    outputs: [{ name: "index", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "rating", type: "int8" },
      { name: "comment", type: "string" },
    ],
    name: "giveFeedback",
    outputs: [{ name: "index", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "index", type: "uint256" },
    ],
    name: "revokeFeedback",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "index", type: "uint256" },
      { name: "response", type: "string" },
    ],
    name: "appendResponse",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: true, name: "client", type: "address" },
      { indexed: true, name: "index", type: "uint256" },
      { indexed: false, name: "rating", type: "int8" },
      { indexed: false, name: "comment", type: "string" },
    ],
    name: "FeedbackGiven",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: true, name: "client", type: "address" },
      { indexed: true, name: "index", type: "uint256" },
    ],
    name: "FeedbackRevoked",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: true, name: "feedbackIndex", type: "uint256" },
      { indexed: false, name: "response", type: "string" },
    ],
    name: "ResponseAppended",
    type: "event",
  },
] as const;
