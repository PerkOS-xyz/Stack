/**
 * ERC-8183 (Agentic Commerce) — minimal ABI for the AgenticCommerce Job primitive.
 *
 * Spec: https://eips.ethereum.org/EIPS/eip-8183
 * Job lifecycle: Open → Funded → Submitted → Completed | Rejected | Expired.
 * Roles: client (funds), provider (submits), evaluator (completes/rejects).
 *
 * NOTE: this ABI must match the deployed `AgenticCommerce` contract. The exact
 * param encoding (e.g. the trailing `optParams` bytes, `bytes32` deliverable/
 * reason) follows the EIP; if the deployed contract differs, update here.
 */
export const AGENTIC_COMMERCE_ABI = [
  // --- reads ---
  {
    type: "function",
    name: "getJob",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      {
        name: "job",
        type: "tuple",
        components: [
          { name: "client", type: "address" },
          { name: "provider", type: "address" },
          { name: "evaluator", type: "address" },
          { name: "description", type: "string" },
          { name: "budget", type: "uint256" },
          { name: "expiredAt", type: "uint256" },
          { name: "status", type: "uint8" }, // 0 Open,1 Funded,2 Submitted,3 Completed,4 Rejected,5 Expired
          { name: "hook", type: "address" },
        ],
      },
    ],
  },
  { type: "function", name: "paymentToken", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  // --- writes (calldata is built server-side; the party signs client-side) ---
  {
    type: "function",
    name: "createJob",
    stateMutability: "nonpayable",
    inputs: [
      { name: "provider", type: "address" },
      { name: "evaluator", type: "address" },
      { name: "expiredAt", type: "uint256" },
      { name: "description", type: "string" },
      { name: "hook", type: "address" },
    ],
    outputs: [{ name: "jobId", type: "uint256" }],
  },
  {
    type: "function",
    name: "setBudget",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "fund",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "expectedBudget", type: "uint256" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "submit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "deliverable", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "complete",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "reason", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "reject",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "reason", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimRefund",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [],
  },
  // --- events ---
  {
    type: "event",
    name: "JobCreated",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "provider", type: "address", indexed: false },
      { name: "evaluator", type: "address", indexed: false },
      { name: "expiredAt", type: "uint256", indexed: false },
    ],
  },
  { type: "event", name: "JobFunded", inputs: [{ name: "jobId", type: "uint256", indexed: true }, { name: "client", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }] },
  { type: "event", name: "JobSubmitted", inputs: [{ name: "jobId", type: "uint256", indexed: true }, { name: "provider", type: "address", indexed: true }, { name: "deliverable", type: "bytes32", indexed: false }] },
  { type: "event", name: "JobCompleted", inputs: [{ name: "jobId", type: "uint256", indexed: true }, { name: "evaluator", type: "address", indexed: true }, { name: "reason", type: "bytes32", indexed: false }] },
  { type: "event", name: "JobRejected", inputs: [{ name: "jobId", type: "uint256", indexed: true }, { name: "rejector", type: "address", indexed: true }, { name: "reason", type: "bytes32", indexed: false }] },
  { type: "event", name: "JobExpired", inputs: [{ name: "jobId", type: "uint256", indexed: true }] },
  { type: "event", name: "PaymentReleased", inputs: [{ name: "jobId", type: "uint256", indexed: true }, { name: "provider", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }] },
  { type: "event", name: "Refunded", inputs: [{ name: "jobId", type: "uint256", indexed: true }, { name: "client", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }] },
] as const;

/** ERC-8183 job status enum (matches the `status` uint8 in getJob). */
export const ACP_JOB_STATUS = ["Open", "Funded", "Submitted", "Completed", "Rejected", "Expired"] as const;
export type AcpJobStatus = (typeof ACP_JOB_STATUS)[number];
