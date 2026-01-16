"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWalletContext, useWalletClient, ACTIVE_PROVIDER } from "@/lib/wallet/client";
import { Header } from "@/components/Header";
import { useSubscription } from "@/lib/contexts/SubscriptionContext";
import Link from "next/link";
import {
  SUBSCRIPTION_TIERS,
  SubscriptionTier,
  getAllTiers,
} from "@/lib/config/subscriptions";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  formatUnits,
  hashTypedData,
  type Address,
  type WalletClient,
} from "viem";
import {
  getChainByNetwork,
  getUSDCAddress,
  SUPPORTED_NETWORKS,
  type SupportedNetwork,
  getBlockExplorerUrl,
  isTestnet,
  getChainIdFromNetwork,
} from "@/lib/utils/chains";
import {
  generateNonce,
  createEIP712Domain,
  TRANSFER_WITH_AUTHORIZATION_TYPES,
  parsePriceToUSDC,
  getValidBefore,
  getValidAfter,
  formatPaymentPayload,
  encodePaymentHeader,
  type PaymentEnvelope,
} from "@/lib/utils/x402-payment";

// Force dynamic rendering
export const dynamic = "force-dynamic";

// ERC20 ABI for balance and transfer
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

// Network display info
const NETWORK_INFO: Record<string, { name: string; icon: string; color: string }> = {
  avalanche: { name: "Avalanche", icon: "🔺", color: "from-red-500 to-red-600" },
  "avalanche-fuji": { name: "Avalanche Fuji", icon: "🔺", color: "from-red-400 to-red-500" },
  base: { name: "Base", icon: "🔵", color: "from-blue-500 to-blue-600" },
  "base-sepolia": { name: "Base Sepolia", icon: "🔵", color: "from-blue-400 to-blue-500" },
  celo: { name: "Celo", icon: "🟢", color: "from-green-500 to-green-600" },
  "celo-sepolia": { name: "Celo Sepolia", icon: "🟢", color: "from-green-400 to-green-500" },
  polygon: { name: "Polygon", icon: "🟣", color: "from-purple-500 to-purple-600" },
  "polygon-amoy": { name: "Polygon Amoy", icon: "🟣", color: "from-purple-400 to-purple-500" },
  arbitrum: { name: "Arbitrum", icon: "🔷", color: "from-sky-500 to-sky-600" },
  "arbitrum-sepolia": { name: "Arbitrum Sepolia", icon: "🔷", color: "from-sky-400 to-sky-500" },
  optimism: { name: "Optimism", icon: "🔴", color: "from-rose-500 to-rose-600" },
  "optimism-sepolia": { name: "Optimism Sepolia", icon: "🔴", color: "from-rose-400 to-rose-500" },
};

// Helper to get chain ID from network name
const getChainId = (network: SupportedNetwork): number | undefined => {
  return getChainIdFromNetwork(network);
};

// Filter networks to only show mainnets with USDC configured
const PAYMENT_NETWORKS = SUPPORTED_NETWORKS.filter((network) => {
  const chainId = getChainId(network);
  if (!chainId) return false;
  // Only show mainnets
  if (isTestnet(chainId)) return false;
  const usdcAddress = getUSDCAddress(chainId);
  return usdcAddress && usdcAddress !== "0x0000000000000000000000000000000000000000";
});

export default function SubscriptionPaymentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isConnected, address } = useWalletContext();
  const { refetch: refetchSubscription } = useSubscription();

  // Get tier and billing from query params
  const tierParam = searchParams.get("tier") as SubscriptionTier | null;
  const billingParam = (searchParams.get("billing") || "monthly") as "monthly" | "yearly";

  // State
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedNetwork>("base");
  const [usdcBalance, setUsdcBalance] = useState<bigint | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [paymentReceiver, setPaymentReceiver] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string;
    code: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    discount_amount: number;
    final_amount: number;
  } | null>(null);

  // Get chain config for selected network
  const currentChain = getChainByNetwork(selectedNetwork);

  // Wallet client for signing (works with Para, Dynamic, or external wallets)
  const {
    walletClient,
    account: walletAccount,
    isLoading: isWalletClientLoading,
    canSign,
    isExternalWallet,
  } = useWalletClient({
    chain: currentChain!,
  });

  // Debug: Log wallet client state
  useEffect(() => {
    console.log("[Payment] Wallet and client state:", {
      isWalletClientLoading,
      hasWalletClient: !!walletClient,
      hasAccount: !!walletAccount,
      address,
      hasChain: !!currentChain,
      chainId: currentChain?.id,
      canSign,
      isExternalWallet,
      provider: ACTIVE_PROVIDER,
      hasWindowEthereum: typeof window !== "undefined" && !!(window as { ethereum?: object }).ethereum,
    });
  }, [isWalletClientLoading, walletClient, walletAccount, address, currentChain, canSign, isExternalWallet]);

  // Validate tier
  const isValidTier = tierParam && getAllTiers().includes(tierParam) && tierParam !== "free" && tierParam !== "enterprise";
  const tier = isValidTier ? tierParam : null;
  const tierConfig = tier ? SUBSCRIPTION_TIERS[tier] : null;
  const price = tierConfig
    ? billingParam === "monthly"
      ? tierConfig.priceMonthly
      : tierConfig.priceYearly
    : 0;

  // Fetch payment requirements
  useEffect(() => {
    async function fetchRequirements() {
      if (!tier) return;
      try {
        const response = await fetch(`/api/subscription/pay?tier=${tier}&billingCycle=${billingParam}`);
        const data = await response.json();
        if (data.success && data.requirements) {
          setPaymentReceiver(data.requirements.paymentReceiver);
        }
      } catch (err) {
        console.error("Error fetching payment requirements:", err);
      }
    }
    fetchRequirements();
  }, [tier, billingParam]);

  // Fetch USDC balance
  const fetchBalance = useCallback(async () => {
    if (!address || !selectedNetwork) return;

    setIsLoadingBalance(true);
    try {
      const chain = getChainByNetwork(selectedNetwork);
      const chainId = getChainId(selectedNetwork);
      const usdcAddress = chainId ? getUSDCAddress(chainId) : undefined;

      if (!chain || !usdcAddress) {
        setUsdcBalance(null);
        return;
      }

      const client = createPublicClient({
        chain,
        transport: http(),
      });

      const balance = await client.readContract({
        address: usdcAddress as Address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      });

      setUsdcBalance(balance as bigint);
    } catch (err) {
      console.error("Error fetching USDC balance:", err);
      setUsdcBalance(null);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [address, selectedNetwork]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Format balance for display
  const formatBalance = (balance: bigint | null): string => {
    if (balance === null) return "—";
    return parseFloat(formatUnits(balance, 6)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Calculate final price (with coupon if applied)
  const finalPrice = appliedCoupon ? appliedCoupon.final_amount : price;

  // Check if user has sufficient balance (use discounted price if coupon applied)
  const hasSufficientBalance = usdcBalance !== null && usdcBalance >= parseUnits(finalPrice.toString(), 6);

  // State for manual tx hash input
  const [manualTxHash, setManualTxHash] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [copied, setCopied] = useState(false);

  // Get USDC address for current network
  const currentChainId = getChainId(selectedNetwork);
  const currentUsdcAddress = currentChainId ? getUSDCAddress(currentChainId) : undefined;

  // Copy payment address to clipboard
  const copyPaymentAddress = async () => {
    if (paymentReceiver) {
      await navigator.clipboard.writeText(paymentReceiver);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Verify payment after manual transaction
  const verifyPayment = async (hash: string) => {
    if (!address || !tier || !hash) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Wait a bit for the transaction to be indexed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify payment on backend
      const response = await fetch("/api/subscription/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userWalletAddress: address,
          tier,
          billingCycle: billingParam,
          network: selectedNetwork,
          transactionHash: hash,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Payment verification failed");
      }

      setTxHash(hash);
      setPaymentSuccess(true);
    } catch (err) {
      console.error("Payment error:", err);
      setError(err instanceof Error ? err.message : "Payment verification failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle x402 payment signing and verification
  const handlePayment = async () => {
    if (!address || !tier || !paymentReceiver || !canSign) {
      setError("Wallet not connected or payment not configured");
      return;
    }

    setIsSigning(true);
    setError(null);

    try {
      // Get USDC address for current network
      const chainId = getChainId(selectedNetwork);
      if (!chainId) {
        throw new Error("Invalid network selected");
      }

      const usdcAddress = getUSDCAddress(chainId) as Address;
      if (!usdcAddress) {
        throw new Error("USDC not available on this network");
      }

      // Parse price to USDC atomic units (6 decimals) - use discounted price if coupon applied
      const amountInUSDC = parsePriceToUSDC(finalPrice);

      // Generate random nonce
      const nonce = generateNonce();

      // Create authorization valid for 1 hour
      const validAfter = getValidAfter();
      const validBefore = getValidBefore();

      const authorization = {
        from: address,
        to: paymentReceiver as Address,
        value: amountInUSDC,
        validAfter,
        validBefore,
        nonce,
      };

      // Create EIP-712 domain for USDC
      const domain = createEIP712Domain(selectedNetwork, usdcAddress);

      console.log("[Payment] Signing EIP-712 authorization:", {
        domain,
        authorization: {
          ...authorization,
          value: authorization.value.toString(),
          validAfter: authorization.validAfter.toString(),
          validBefore: authorization.validBefore.toString(),
        },
        signingMethod: walletAccount ? "account" : "walletClient",
        provider: ACTIVE_PROVIDER,
        isExternalWallet,
      });

      let signature: `0x${string}`;

      // For external wallets, ensure we're on the correct chain first
      if (isExternalWallet) {
        const ethereum = (window as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
        if (ethereum) {
          try {
            // Request chain switch to match the selected network
            const chainIdHex = `0x${chainId.toString(16)}`;
            console.log("[Payment] Switching to chain:", chainIdHex);
            await ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: chainIdHex }],
            });
            console.log("[Payment] Chain switch successful");
          } catch (switchError: unknown) {
            const error = switchError as { code?: number };
            // If chain doesn't exist in wallet, try to add it
            if (error.code === 4902) {
              console.log("[Payment] Chain not found, attempting to add...");
              const chain = getChainByNetwork(selectedNetwork);
              if (chain) {
                await ethereum.request({
                  method: "wallet_addEthereumChain",
                  params: [{
                    chainId: `0x${chainId.toString(16)}`,
                    chainName: chain.name,
                    nativeCurrency: chain.nativeCurrency,
                    rpcUrls: [chain.rpcUrls.default.http[0]],
                    blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : [],
                  }],
                });
              }
            } else if (error.code === 4001) {
              // User rejected the switch
              throw new Error("Please switch to the correct network in your wallet");
            } else {
              console.error("[Payment] Chain switch error:", switchError);
              throw new Error(`Please switch to ${currentChain?.name || selectedNetwork} in your wallet`);
            }
          }
        }
      }

      // Sign the payment authorization using the unified wallet client
      if (walletAccount) {
        // Para SDK provides an account object with signTypedData
        signature = await walletAccount.signTypedData({
          domain,
          types: TRANSFER_WITH_AUTHORIZATION_TYPES,
          primaryType: "TransferWithAuthorization",
          message: authorization,
        });
      } else if (walletClient) {
        // Use wallet client for Dynamic or external wallets
        signature = await walletClient.signTypedData({
          account: address,
          domain,
          types: TRANSFER_WITH_AUTHORIZATION_TYPES,
          primaryType: "TransferWithAuthorization",
          message: authorization,
        });
      } else {
        throw new Error("No signing method available");
      }

      console.log("[Payment] Signature obtained:", signature);

      // Create payment envelope
      const envelope: PaymentEnvelope = {
        network: selectedNetwork,
        authorization: {
          from: authorization.from,
          to: authorization.to,
          value: authorization.value.toString(),
          nonce: authorization.nonce,
          validAfter: authorization.validAfter.toString(),
          validBefore: authorization.validBefore.toString(),
        },
        signature,
      };

      // Format as x402 v2 payload
      const paymentPayload = formatPaymentPayload(envelope);

      console.log("[Payment] Submitting payment for verification...");

      // Submit to backend for verification and settlement
      setIsProcessing(true);
      setIsSigning(false);

      const response = await fetch("/api/subscription/pay/x402", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userWalletAddress: address,
          tier,
          billingCycle: billingParam,
          network: selectedNetwork,
          paymentPayload,
          // Include coupon data if applied
          coupon: appliedCoupon ? {
            id: appliedCoupon.id,
            code: appliedCoupon.code,
            discount_amount: appliedCoupon.discount_amount,
            original_amount: price,
            final_amount: appliedCoupon.final_amount,
          } : undefined,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Payment verification failed");
      }

      console.log("[Payment] Payment successful:", result);

      setTxHash(result.payment?.transactionHash || null);
      setPaymentSuccess(true);

      // Refresh subscription data in the header
      await refetchSubscription();
    } catch (err: any) {
      // Parse error for user-friendly messages
      let errorMessage = "Payment failed";
      let isUserCancellation = false;

      if (err instanceof Error) {
        const message = err.message.toLowerCase();

        // Detect user cancellation/rejection
        if (
          message.includes("user rejected") ||
          message.includes("user denied") ||
          message.includes("user cancelled") ||
          message.includes("rejected the request") ||
          (err.cause as any)?.code === 4001 ||
          (err as any).code === 4001
        ) {
          errorMessage = "Transaction cancelled. You can try again when ready.";
          isUserCancellation = true;
        }
        // Network switch rejected
        else if (message.includes("switch to the correct network")) {
          errorMessage = err.message;
        }
        // Insufficient funds
        else if (message.includes("insufficient") || message.includes("balance")) {
          errorMessage = "Insufficient USDC balance for this transaction.";
        }
        // Generic RPC errors
        else if (message.includes("rpc error") || message.includes("internal error")) {
          errorMessage = "Network error. Please check your wallet connection and try again.";
        }
        // Pass through other errors but clean them up
        else {
          // Remove version info from viem errors
          errorMessage = err.message.replace(/Version: viem@[\d.]+/gi, "").trim();
          // Remove "Details:" prefix if it just repeats the message
          errorMessage = errorMessage.replace(/Details:\s*(.+?)\s*$/i, (_, detail) => detail);
        }
      }

      // Log appropriately based on error type
      if (isUserCancellation) {
        // User cancellations are expected behavior, not errors
        console.info("[Payment] User cancelled transaction");
      } else {
        // Actual errors should be logged for debugging
        console.error("[Payment] Error:", err);
      }

      setError(errorMessage);
    } finally {
      setIsSigning(false);
      setIsProcessing(false);
    }
  };

  // Legacy: Handle manual tx hash verification (fallback)
  const handleManualPayment = () => {
    setShowManualInput(true);
  };

  // Validate and apply coupon
  const validateCoupon = async () => {
    if (!couponCode.trim() || !address || !tier) return;

    setIsValidatingCoupon(true);
    setCouponError(null);

    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode.trim().toUpperCase(),
          address,
          tier,
          amount: price,
        }),
      });

      const result = await response.json();

      if (!result.valid) {
        setCouponError(result.error || "Invalid coupon code");
        setAppliedCoupon(null);
        return;
      }

      setAppliedCoupon({
        id: result.coupon.id,
        code: result.coupon.code,
        discount_type: result.coupon.discount_type,
        discount_value: result.coupon.discount_value,
        discount_amount: result.discount_amount,
        final_amount: result.final_amount,
      });
      setCouponError(null);
    } catch (err) {
      console.error("Error validating coupon:", err);
      setCouponError("Failed to validate coupon");
      setAppliedCoupon(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  // Remove applied coupon
  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);
  };

  // Redirect if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
        <Header />
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-md mx-auto text-center">
            <div className="text-6xl mb-6">🔒</div>
            <h1 className="text-2xl font-bold text-gray-100 mb-4">Connect Wallet</h1>
            <p className="text-gray-400 mb-8">Please connect your wallet to continue with payment.</p>
            <Link
              href="/subscription"
              className="inline-block px-6 py-3 bg-slate-700 text-gray-300 rounded-lg hover:bg-slate-600 transition-all"
            >
              Back to Plans
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Invalid tier
  if (!tier || !tierConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
        <Header />
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-md mx-auto text-center">
            <div className="text-6xl mb-6">❌</div>
            <h1 className="text-2xl font-bold text-gray-100 mb-4">Invalid Plan</h1>
            <p className="text-gray-400 mb-8">The selected plan is not valid for purchase.</p>
            <Link
              href="/subscription"
              className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:opacity-90 transition-all"
            >
              View Available Plans
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Payment success
  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
        <Header />
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-md mx-auto text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-100 mb-4">Payment Successful!</h1>
            <p className="text-gray-400 mb-6">
              Your subscription to <span className="text-cyan-400 font-semibold">{tierConfig.displayName}</span> is now active.
            </p>
            {txHash && (
              <a
                href={`${getBlockExplorerUrl(getChainId(selectedNetwork) || 0)}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm mb-8 inline-block"
              >
                View Transaction →
              </a>
            )}
            <div className="mt-8">
              <Link
                href="/subscription"
                className="inline-block px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:opacity-90 transition-all font-medium"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      {/* Subtle gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-blue-950/20 via-transparent to-cyan-950/10 pointer-events-none" />

      {/* Subtle dot pattern */}
      <div className="fixed inset-0 opacity-[0.03]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
        backgroundSize: '24px 24px'
      }} />

      <div className="relative">
        <Header />

        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="max-w-5xl mx-auto">
            {/* Back Link */}
            <Link
              href="/subscription"
              className="group inline-flex items-center text-slate-500 hover:text-slate-300 mb-8 transition-colors text-sm"
            >
              <svg className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Plans
            </Link>

            {/* Main Grid - Equal Height Cards */}
            <div className="grid lg:grid-cols-5 gap-6 items-stretch">
              {/* Left Side - Order Summary */}
              <div className="lg:col-span-2 flex">
                <div className="flex-1 bg-gradient-to-b from-slate-800/40 to-slate-900/40 border border-slate-700/30 rounded-2xl p-6 backdrop-blur-sm flex flex-col">
                  {/* Stack Logo */}
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                      <img
                        src="/logo.png"
                        alt="Stack"
                        className="w-7 h-7"
                      />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-white tracking-tight">Stack</h2>
                      <p className="text-slate-500 text-xs">Payment Infrastructure</p>
                    </div>
                  </div>

                  {/* Plan Info */}
                  <div className="flex items-start gap-4 mb-6">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${
                      tier === "starter" ? "from-blue-500 to-indigo-600" :
                      tier === "pro" ? "from-violet-500 to-purple-600" :
                      "from-amber-500 to-orange-600"
                    } flex items-center justify-center text-2xl shadow-lg ${
                      tier === "starter" ? "shadow-blue-500/25" :
                      tier === "pro" ? "shadow-violet-500/25" :
                      "shadow-amber-500/25"
                    }`}>
                      {tier === "starter" ? "🚀" : tier === "pro" ? "⚡" : "📈"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-white">{tierConfig.displayName}</h3>
                      <p className="text-slate-400 text-sm mt-0.5">{tierConfig.description}</p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent mb-6" />

                  {/* Features Preview */}
                  <div className="flex-1">
                    <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-3">What's included</p>
                    <ul className="space-y-2.5">
                      {tierConfig.features.slice(0, 4).map((feature, idx) => (
                        <li key={idx} className="flex items-start text-sm text-slate-300">
                          <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center mr-2.5 mt-0.5 flex-shrink-0">
                            <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span>{feature}</span>
                        </li>
                      ))}
                      {tierConfig.features.length > 4 && (
                        <li className="text-slate-500 text-sm pl-[30px]">
                          +{tierConfig.features.length - 4} more features
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent my-6" />

                  {/* Coupon Code Section */}
                  <div className="mb-6">
                    <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">Coupon Code</p>
                    {appliedCoupon ? (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-emerald-400 font-semibold text-sm">{appliedCoupon.code}</p>
                              <p className="text-emerald-400/70 text-xs">
                                {appliedCoupon.discount_type === "percentage"
                                  ? `${appliedCoupon.discount_value}% off`
                                  : `$${appliedCoupon.discount_value} off`}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={removeCoupon}
                            className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800/50 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => {
                            setCouponCode(e.target.value.toUpperCase());
                            setCouponError(null);
                          }}
                          onKeyDown={(e) => e.key === "Enter" && validateCoupon()}
                          placeholder="Enter code"
                          className="flex-1 px-3 py-2.5 bg-slate-900/60 border border-slate-700/40 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all uppercase"
                        />
                        <button
                          onClick={validateCoupon}
                          disabled={!couponCode.trim() || isValidatingCoupon}
                          className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                            couponCode.trim() && !isValidatingCoupon
                              ? "bg-slate-700 text-white hover:bg-slate-600"
                              : "bg-slate-800 text-slate-500 cursor-not-allowed"
                          }`}
                        >
                          {isValidatingCoupon ? (
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            "Apply"
                          )}
                        </button>
                      </div>
                    )}
                    {couponError && (
                      <p className="text-red-400 text-xs mt-2 flex items-center">
                        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {couponError}
                      </p>
                    )}
                  </div>

                  {/* Billing Details */}
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{tierConfig.displayName} ({billingParam})</span>
                      <span className={`font-medium ${appliedCoupon ? "text-slate-500 line-through" : "text-slate-300"}`}>${price}.00</span>
                    </div>
                    {appliedCoupon && (
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-400">Discount ({appliedCoupon.code})</span>
                        <span className="text-emerald-400 font-medium">-${appliedCoupon.discount_amount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Network fee</span>
                      <span className="text-slate-500">~$0.01</span>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="mt-4 pt-4 border-t border-slate-700/30">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400 text-sm">Total due today</span>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-white">${finalPrice.toFixed(2)}</span>
                        <span className="text-slate-400 text-sm ml-1">USDC</span>
                      </div>
                    </div>
                    {appliedCoupon && (
                      <p className="text-emerald-400 text-xs mt-1 text-right">
                        You save ${appliedCoupon.discount_amount.toFixed(2)}!
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Side - Payment Form */}
              <div className="lg:col-span-3 flex">
                <div className="flex-1 bg-gradient-to-b from-slate-800/60 to-slate-900/60 border border-slate-700/40 rounded-2xl p-6 md:p-8 backdrop-blur-sm relative overflow-hidden flex flex-col">
                  {/* Subtle accent glow */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

                  <div className="relative flex-1 flex flex-col">
                    <h2 className="text-lg font-semibold text-white mb-6">Payment Details</h2>

                    {/* Connected Wallet */}
                    <div className="mb-5">
                      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                        Connected Wallet
                      </label>
                      <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-3.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-white font-mono text-sm">
                                {address?.slice(0, 6)}...{address?.slice(-4)}
                              </p>
                              <p className="text-slate-500 text-xs capitalize">{ACTIVE_PROVIDER} Wallet</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 rounded-full">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                            <span className="text-emerald-400 text-xs font-medium">Connected</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Network Selection - Dropdown */}
                    <div className="mb-5">
                      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                        Network
                      </label>
                      <div className="relative">
                        <select
                          value={selectedNetwork}
                          onChange={(e) => setSelectedNetwork(e.target.value as SupportedNetwork)}
                          className="w-full appearance-none bg-slate-900/60 border border-slate-700/40 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 cursor-pointer transition-all"
                        >
                          {PAYMENT_NETWORKS.map((network) => {
                            const info = NETWORK_INFO[network] || { name: network, icon: "⚫", color: "from-gray-500 to-gray-600" };
                            return (
                              <option key={network} value={network}>
                                {info.icon} {info.name}
                              </option>
                            );
                          })}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* USDC Balance */}
                    <div className="mb-6 flex-1">
                      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                        Your Balance
                      </label>
                      <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-3.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-500/15 flex items-center justify-center">
                              <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z"/>
                              </svg>
                            </div>
                            <div>
                              <p className="text-white font-semibold">
                                {isLoadingBalance ? (
                                  <span className="text-slate-500">Loading...</span>
                                ) : (
                                  <>{formatBalance(usdcBalance)} <span className="text-slate-400 font-normal">USDC</span></>
                                )}
                              </p>
                              <p className="text-slate-500 text-xs">
                                on {NETWORK_INFO[selectedNetwork]?.name || selectedNetwork}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={fetchBalance}
                            className="text-slate-500 hover:text-slate-300 p-2 rounded-lg hover:bg-slate-800/50 transition-all"
                            title="Refresh balance"
                          >
                            <svg className={`w-4 h-4 ${isLoadingBalance ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        </div>

                        {/* Insufficient balance warning */}
                        {usdcBalance !== null && !hasSufficientBalance && (
                          <div className="mt-3 pt-3 border-t border-slate-700/30">
                            <p className="text-amber-400 text-sm flex items-center">
                              <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Insufficient balance. You need ${price} USDC.
                            </p>
                          </div>
                        )}

                        {/* Wallet client initialization warning */}
                        {!isWalletClientLoading && !canSign && isConnected && (
                          <div className="mt-3 pt-3 border-t border-slate-700/30">
                            <p className="text-amber-400 text-sm flex items-center">
                              <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Wallet signing not available. Please reconnect your wallet or enable browser wallet.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                      <div className={`mb-5 p-4 rounded-xl border ${
                        error.includes("cancelled") || error.includes("try again")
                          ? "bg-amber-500/10 border-amber-500/20"
                          : "bg-red-500/10 border-red-500/20"
                      }`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              error.includes("cancelled") || error.includes("try again")
                                ? "bg-amber-500/20"
                                : "bg-red-500/20"
                            }`}>
                              {error.includes("cancelled") || error.includes("try again") ? (
                                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <p className={`text-sm font-medium ${
                                error.includes("cancelled") || error.includes("try again")
                                  ? "text-amber-400"
                                  : "text-red-400"
                              }`}>
                                {error.includes("cancelled") || error.includes("try again") ? "Transaction Cancelled" : "Payment Error"}
                              </p>
                              <p className={`text-xs mt-1 ${
                                error.includes("cancelled") || error.includes("try again")
                                  ? "text-amber-400/70"
                                  : "text-red-400/70"
                              }`}>
                                {error}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setError(null)}
                            className={`p-1 rounded-lg transition-colors flex-shrink-0 ${
                              error.includes("cancelled") || error.includes("try again")
                                ? "text-amber-400/50 hover:text-amber-400 hover:bg-amber-500/10"
                                : "text-red-400/50 hover:text-red-400 hover:bg-red-500/10"
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Payment Instructions (shown after clicking Pay) */}
                    {showManualInput ? (
                      <div className="space-y-5 mt-auto">
                        {/* Payment Instructions */}
                        <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4">
                          <h4 className="text-cyan-400 font-medium mb-3 flex items-center text-sm">
                            <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center mr-2 text-xs font-bold">1</span>
                            Send USDC to this address
                          </h4>
                          <div className="bg-slate-900/60 rounded-lg p-3">
                            <div className="flex items-center justify-between gap-3">
                              <code className="text-slate-300 text-xs font-mono break-all leading-relaxed">
                                {paymentReceiver}
                              </code>
                              <button
                                onClick={copyPaymentAddress}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all flex-shrink-0"
                              >
                                {copied ? (
                                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                            </div>
                            <div className="mt-2 text-xs text-slate-500">
                              Amount: <span className="text-white font-semibold">${finalPrice.toFixed(2)} USDC</span> on {NETWORK_INFO[selectedNetwork]?.name || selectedNetwork}
                              {appliedCoupon && <span className="text-emerald-400 ml-1">(with coupon)</span>}
                            </div>
                          </div>
                        </div>

                        {/* Transaction Hash Input */}
                        <div>
                          <h4 className="text-cyan-400 font-medium mb-3 flex items-center text-sm">
                            <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center mr-2 text-xs font-bold">2</span>
                            Enter transaction hash
                          </h4>
                          <input
                            type="text"
                            value={manualTxHash}
                            onChange={(e) => setManualTxHash(e.target.value)}
                            placeholder="0x..."
                            className="w-full px-4 py-3 bg-slate-900/60 border border-slate-700/40 rounded-xl text-white placeholder-slate-600 font-mono text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                          />
                        </div>

                        {/* Verify Button */}
                        <button
                          onClick={() => verifyPayment(manualTxHash)}
                          disabled={!manualTxHash || isProcessing}
                          className={`w-full py-3.5 px-6 rounded-xl font-semibold transition-all ${
                            manualTxHash && !isProcessing
                              ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/20"
                              : "bg-slate-800 text-slate-500 cursor-not-allowed"
                          }`}
                        >
                          {isProcessing ? (
                            <span className="flex items-center justify-center">
                              <svg className="animate-spin -ml-1 mr-2.5 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Verifying Payment...
                            </span>
                          ) : (
                            "Verify Payment"
                          )}
                        </button>

                        {/* Back Button */}
                        <button
                          onClick={() => {
                            setShowManualInput(false);
                            setManualTxHash("");
                            setError(null);
                          }}
                          className="w-full py-2.5 text-slate-500 hover:text-slate-300 text-sm transition-colors"
                        >
                          ← Go back
                        </button>
                      </div>
                    ) : (
                      <div className="mt-auto space-y-4">
                        {/* Pay Button */}
                        <button
                          onClick={handlePayment}
                          disabled={!hasSufficientBalance || isProcessing || isSigning || !paymentReceiver || !canSign || isWalletClientLoading}
                          className={`w-full py-3.5 px-6 rounded-xl font-semibold transition-all ${
                            hasSufficientBalance && !isProcessing && !isSigning && paymentReceiver && canSign && !isWalletClientLoading
                              ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30"
                              : "bg-slate-800 text-slate-500 cursor-not-allowed"
                          }`}
                        >
                          {isWalletClientLoading ? (
                            <span className="flex items-center justify-center">
                              <svg className="animate-spin -ml-1 mr-2.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Initializing Wallet...
                            </span>
                          ) : isSigning ? (
                            <span className="flex items-center justify-center">
                              <svg className="animate-spin -ml-1 mr-2.5 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Sign in Wallet...
                            </span>
                          ) : isProcessing ? (
                            <span className="flex items-center justify-center">
                              <svg className="animate-spin -ml-1 mr-2.5 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processing Payment...
                            </span>
                          ) : (
                            <>Sign & Pay ${finalPrice.toFixed(2)} USDC</>
                          )}
                        </button>

                        {/* Signing Info */}
                        {isSigning && (
                          <p className="text-xs text-cyan-400 text-center animate-pulse">
                            Please check your wallet to sign the payment authorization
                          </p>
                        )}

                        {/* Manual Payment Fallback */}
                        <button
                          onClick={handleManualPayment}
                          disabled={isSigning || isProcessing}
                          className="w-full py-2 text-slate-500 hover:text-slate-300 text-xs transition-colors disabled:opacity-50"
                        >
                          Already sent USDC? Verify with transaction hash →
                        </button>

                        {/* Security Note */}
                        <div className="flex items-center justify-center text-slate-600 text-xs">
                          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Gasless • Sign once • Secured by x402
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
