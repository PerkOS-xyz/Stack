import type { Address, Hex } from "viem";

export const AGENT_PAYMENT_BINDING_SCHEMA = "perkos.agent-payment-binding.v1" as const;
export const AGENT_PAYMENT_BINDING_DOMAIN_NAME = "PerkOS Agent Payment Binding" as const;
export const AGENT_PAYMENT_BINDING_DOMAIN_VERSION = "1" as const;

export const AGENT_PAYMENT_BINDING_TYPES = {
  AgentPaymentBinding: [
    { name: "identityRegistry", type: "address" },
    { name: "agentId", type: "uint256" },
    { name: "paymentChainId", type: "uint256" },
    { name: "payTo", type: "address" },
    { name: "asset", type: "address" },
    { name: "issuedAt", type: "uint256" },
    { name: "validUntil", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export interface AgentPaymentBindingFields {
  identityChainId: number;
  identityRegistry: Address;
  agentId: string | number | bigint;
  paymentChainId: number;
  payTo: Address;
  asset: Address;
  issuedAt: number;
  validUntil: number;
  nonce: Hex;
}

export interface AgentPaymentBindingProof extends AgentPaymentBindingFields {
  schema: typeof AGENT_PAYMENT_BINDING_SCHEMA;
  identityNetwork: string;
  paymentNetwork: string;
  signer: Address;
  signature: Hex;
}

/**
 * Typed data signed by an ERC-8004 owner/agentWallet to bind an arbitrary x402
 * receiver on another EVM chain. This is a public identity assertion, not an
 * authorization to move funds.
 */
export function buildAgentPaymentBindingTypedData(fields: AgentPaymentBindingFields) {
  return {
    domain: {
      name: AGENT_PAYMENT_BINDING_DOMAIN_NAME,
      version: AGENT_PAYMENT_BINDING_DOMAIN_VERSION,
      chainId: fields.identityChainId,
      verifyingContract: fields.identityRegistry,
    },
    types: AGENT_PAYMENT_BINDING_TYPES,
    primaryType: "AgentPaymentBinding" as const,
    message: {
      identityRegistry: fields.identityRegistry,
      agentId: BigInt(fields.agentId),
      paymentChainId: BigInt(fields.paymentChainId),
      payTo: fields.payTo,
      asset: fields.asset,
      issuedAt: BigInt(fields.issuedAt),
      validUntil: BigInt(fields.validUntil),
      nonce: fields.nonce,
    },
  };
}
