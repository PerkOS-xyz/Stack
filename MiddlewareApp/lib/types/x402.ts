export type Address = `0x${string}`;
export type Hex = `0x${string}`;

// ============ Standard x402 Types ============

export interface X402VerifyRequest {
  x402Version: number;
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
}

export interface X402SettleRequest extends X402VerifyRequest {}

export interface PaymentPayload {
  x402Version: number;
  scheme: "exact" | "deferred";
  network: string;
  payload: ExactPayload | DeferredPayload;
}

export interface PaymentRequirements {
  scheme: "exact" | "deferred";
  network: string;
  maxAmountRequired: string;
  resource: string;
  description?: string;
  mimeType?: string;
  payTo: Address;
  maxTimeoutSeconds: number;
  asset: Address;
  extra?: DeferredExtra;
}

export interface DeferredExtra {
  type: "new" | "aggregation";
  escrow: Address;
  facilitator?: string;
}

// ============ Exact Scheme (EIP-3009) ============

export interface ExactPayload {
  signature: Hex;
  authorization: TransferAuthorization;
}

export interface TransferAuthorization {
  from: Address;
  to: Address;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
}

// ============ Deferred Scheme ============

export interface DeferredPayload {
  voucher: Voucher;
  signature: Hex;
}

export interface Voucher {
  id: Hex;
  buyer: Address;
  seller: Address;
  valueAggregate: bigint | string;
  asset: Address;
  timestamp: bigint | string;
  nonce: bigint | string;
  escrow: Address;
  chainId: bigint | string;
}

// ============ Response Types ============

export interface VerifyResponse {
  isValid: boolean;
  invalidReason: string | null;
  payer: Address | null;
}

export interface SettleResponse {
  success: boolean;
  error: string | null;
  payer: Address | null;
  transaction: Hex | null;
  network: string;
}

export interface SupportedResponse {
  kinds: Array<{
    scheme: "exact" | "deferred";
    network: string;
  }>;
}

// ============ Deferred Scheme Extended ============

export interface DeferredInfoResponse {
  enabled: boolean;
  escrowAddress: Address;
  network: string;
  chainId: number;
  thawPeriod: number;
  maxDeposit: string;
}

export interface StoredVoucher {
  id: Hex;
  voucher: Voucher;
  signature: Hex;
  buyer: Address;
  seller: Address;
  asset: Address;
  nonce: bigint;
  valueAggregate: bigint;
  timestamp: bigint;
  settled: boolean;
  settledTxHash?: Hex;
  createdAt: Date;
  updatedAt: Date;
}

// ============ ERC-8004 Agent Discovery ============

export interface AgentInfo {
  id: Address;
  name: string;
  description: string;
  endpoint: string;
  capabilities: string[];
  paymentMethods: PaymentMethod[];
  reputation?: ReputationScore;
}

export interface PaymentMethod {
  scheme: "exact" | "deferred";
  network: string;
  asset: Address;
  minAmount?: string;
  maxAmount?: string;
}

export interface ReputationScore {
  totalTransactions: number;
  successfulTransactions: number;
  totalVolume: string;
  averageRating: number;
  lastUpdated: Date;
}

// ============ Bazaar Discovery ============

export interface BazaarService {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  category: string;
  pricing: ServicePricing;
  capabilities: string[];
  tags: string[];
}

export interface ServicePricing {
  scheme: "exact" | "deferred";
  network: string;
  asset: Address;
  amount: string;
  unit: "per-request" | "per-minute" | "per-hour" | "per-day";
}

// ============ Well-Known Types ============

export interface AgentCard {
  "@context": string;
  id: Address;
  type: "Agent";
  name: string;
  description: string;
  url: string;
  capabilities: string[];
  paymentMethods: PaymentMethod[];
  endpoints: {
    x402: string;
    discovery: string;
  };
}

export interface X402PaymentConfig {
  version: number;
  facilitator: string;
  supportedSchemes: Array<{
    scheme: "exact" | "deferred";
    network: string;
  }>;
  endpoints: {
    verify: string;
    settle: string;
    supported: string;
  };
}
