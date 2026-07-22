export const ERC8183_ABI = [
  {
    type: "function", name: "createJob", stateMutability: "nonpayable",
    inputs: [
      { name: "provider", type: "address" }, { name: "evaluator", type: "address" },
      { name: "expiredAt", type: "uint48" }, { name: "description", type: "string" },
      { name: "hook", type: "address" }, { name: "providerAgentId", type: "uint256" },
    ], outputs: [{ name: "jobId", type: "uint256" }],
  },
  {
    type: "function", name: "setBudget", stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" }, { name: "token", type: "address" },
      { name: "amount", type: "uint256" }, { name: "optParams", type: "bytes" },
    ], outputs: [],
  },
  {
    type: "function", name: "fund", stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" }, { name: "expectedToken", type: "address" },
      { name: "expectedBudget", type: "uint256" }, { name: "optParams", type: "bytes" },
    ], outputs: [],
  },
  {
    type: "function", name: "submit", stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" }, { name: "deliverable", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ], outputs: [],
  },
  {
    type: "function", name: "complete", stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" }, { name: "reason", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ], outputs: [],
  },
  {
    type: "function", name: "reject", stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" }, { name: "reason", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ], outputs: [],
  },
  {
    type: "function", name: "claimRefund", stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }], outputs: [],
  },
  {
    type: "function", name: "getJob", stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [{
      name: "", type: "tuple", components: [
        { name: "client", type: "address" }, { name: "status", type: "uint8" },
        { name: "provider", type: "address" }, { name: "expiredAt", type: "uint48" },
        { name: "evaluator", type: "address" }, { name: "submittedAt", type: "uint48" },
        { name: "budget", type: "uint256" }, { name: "hook", type: "address" },
        { name: "paymentToken", type: "address" }, { name: "providerAgentId", type: "uint256" },
        { name: "description", type: "string" }, { name: "settledAmount", type: "uint256" },
        { name: "payoutReceiver", type: "address" },
      ],
    }],
  },
] as const;
