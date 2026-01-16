/**
 * Server-side wallet service interface
 *
 * This interface abstracts server-controlled wallet operations including
 * wallet creation, transaction signing, and key management.
 *
 * Implementations: ParaServerService, DynamicServerService, etc.
 *
 * x402 Protocol Compliance:
 * - Supports both EVM and Solana (SVM) for multi-chain x402 payments
 * - See: https://www.x402.org/ and https://solana.com/x402/what-is-x402
 */

import type { Signer } from "ethers";
import type { Chain, WalletClient, Account } from "viem";
import type { Transaction as SolanaTransaction, PublicKey } from "@solana/web3.js";

/**
 * Response from wallet creation
 */
export interface CreateWalletResponse {
  walletId: string;
  address: string;
  walletType: "EVM" | "SOLANA";

  /**
   * Provider-specific key material for signing
   * - Para: "userShare" from MPC
   * - Dynamic: embedded wallet credentials
   * - Privy: server wallet token
   */
  keyMaterial?: string;

  /**
   * Additional provider-specific metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Wallet information for existing wallets
 */
export interface WalletInfo {
  walletId: string;
  address: string;
  walletType: "EVM" | "SOLANA";
  createdAt?: Date;
}

/**
 * Solana signer interface compatible with @solana/web3.js
 * Used for x402 Solana payment signing
 */
export interface SolanaSigner {
  /**
   * The public key of the signer
   */
  publicKey: PublicKey;

  /**
   * Signs a Solana transaction
   * @param transaction - The transaction to sign
   * @returns The signed transaction
   */
  signTransaction(transaction: SolanaTransaction): Promise<SolanaTransaction>;
}

/**
 * Server-side wallet service interface
 */
export interface IServerWalletService {
  /**
   * Create a new server-controlled wallet
   * @param userId - User identifier for wallet association
   * @param network - Network type (evm for multi-chain EVM, solana for Solana)
   */
  createWallet(userId: string, network: "evm" | "solana"): Promise<CreateWalletResponse>;

  /**
   * Get an ethers.js compatible signer for a wallet
   * @param walletId - Provider wallet identifier
   * @param rpcUrl - RPC endpoint URL
   * @param keyMaterial - Provider-specific key material (userShare, etc.)
   */
  getSigner(walletId: string, rpcUrl: string, keyMaterial?: string): Promise<Signer>;

  /**
   * Get a viem WalletClient for a wallet
   * @param walletId - Provider wallet identifier
   * @param chain - Viem chain configuration
   * @param keyMaterial - Provider-specific key material
   */
  getViemClient(walletId: string, chain: Chain, keyMaterial?: string): Promise<WalletClient>;

  /**
   * Get a viem Account for a wallet
   * @param walletId - Provider wallet identifier
   * @param keyMaterial - Provider-specific key material
   */
  getViemAccount?(walletId: string, keyMaterial?: string): Promise<Account>;

  /**
   * Sign a message with a wallet
   * @param walletId - Provider wallet identifier
   * @param message - Message to sign
   * @param keyMaterial - Provider-specific key material
   */
  signMessage(walletId: string, message: string, keyMaterial?: string): Promise<string>;

  /**
   * Restore wallet signing capability (for providers that require it)
   * @param walletId - Provider wallet identifier
   * @param keyMaterial - Provider-specific key material
   */
  restoreWallet?(walletId: string, keyMaterial: string): Promise<void>;

  /**
   * Get a Solana signer for a wallet (x402 SVM support)
   * @param walletId - Provider wallet identifier
   * @param keyMaterial - Provider-specific key material
   * @returns Solana signer compatible with @solana/web3.js
   */
  getSolanaSigner?(walletId: string, keyMaterial?: string): Promise<SolanaSigner>;

  /**
   * Check if the service supports Solana wallets
   */
  supportsSolana?(): boolean;

  /**
   * Check if the service is properly initialized
   */
  isInitialized(): boolean;
}

/**
 * Factory function type for creating wallet service instances
 */
export type ServerWalletServiceFactory = () => IServerWalletService;
