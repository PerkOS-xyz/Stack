"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWallet } from "@getpara/react-sdk";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  SUBSCRIPTION_TIERS,
  SubscriptionTier,
  TierConfig,
  getAllTiers,
} from "@/lib/config/subscriptions";

// Force dynamic rendering
export const dynamic = "force-dynamic";

interface UsageMetric {
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
}

interface SubscriptionStatus {
  tier: SubscriptionTier;
  tierConfig: TierConfig;
  subscription: {
    status: string;
    startedAt: string | null;
    expiresAt: string | null;
    trialEndsAt: string | null;
  } | null;
  usage: {
    periodStart: string;
    periodEnd: string;
    transactions: UsageMetric;
    wallets: UsageMetric;
  };
  limits: TierConfig["limits"]; // TierLimits from the tier config
}

export default function SubscriptionPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { data: wallet } = useWallet();
  const address = wallet?.address as `0x${string}` | undefined;

  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const tiers = getAllTiers();

  // Fetch subscription status
  useEffect(() => {
    async function fetchSubscriptionStatus() {
      if (!address) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/subscription?address=${address}`);
        if (response.ok) {
          const result = await response.json();
          // API returns { success: true, data: { ... } }
          if (result.success && result.data) {
            setSubscriptionStatus(result.data);
          } else {
            setError("Invalid subscription response");
          }
        } else {
          setError("Failed to load subscription status");
        }
      } catch (err) {
        console.error("Error fetching subscription:", err);
        setError("Failed to connect to server");
      } finally {
        setIsLoading(false);
      }
    }

    fetchSubscriptionStatus();
  }, [address]);

  const formatNumber = (num: number) => {
    if (num === -1) return "Unlimited";
    if (num >= 1000000) return `${(num / 1000000).toFixed(0)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toLocaleString();
  };

  const formatPrice = (price: number) => {
    if (price === -1) return "Custom";
    if (price === 0) return "Free";
    return `$${price}`;
  };

  const getYearlySavings = (monthly: number, yearly: number) => {
    if (monthly <= 0 || yearly <= 0) return 0;
    const yearlyIfMonthly = monthly * 12;
    return Math.round(((yearlyIfMonthly - yearly) / yearlyIfMonthly) * 100);
  };

  const tierIcons: Record<SubscriptionTier, string> = {
    free: "🆓",
    starter: "🚀",
    pro: "⚡",
    scale: "📈",
    enterprise: "🏢",
  };

  const tierColors: Record<SubscriptionTier, string> = {
    free: "from-gray-500 to-gray-600",
    starter: "from-blue-500 to-blue-600",
    pro: "from-purple-500 to-purple-600",
    scale: "from-orange-500 to-orange-600",
    enterprise: "from-cyan-500 to-cyan-600",
  };

  const tierBorderColors: Record<SubscriptionTier, string> = {
    free: "border-gray-500/30",
    starter: "border-blue-500/30",
    pro: "border-purple-500/30",
    scale: "border-orange-500/30",
    enterprise: "border-cyan-500/30",
  };

  const currentTier = subscriptionStatus?.tier || "free";

  return (
    <div className="min-h-screen bg-[#030308] text-white overflow-x-hidden">
      {/* === ATMOSPHERIC BACKGROUND === */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/20 via-transparent to-amber-950/10" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(to right, #06b6d4 1px, transparent 1px), linear-gradient(to bottom, #06b6d4 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-radial from-cyan-500/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-radial from-amber-500/5 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-radial from-violet-500/5 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
      </div>

      <div className="relative">
        <Header />

        <div className="container mx-auto px-4 py-12">
          <div className="max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-4">
                Subscription Plans
              </h1>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Choose the plan that fits your needs. All plans include access to all supported networks.
              </p>
            </div>

            {/* Current Status (when logged in) */}
            {isConnected && address && subscriptionStatus && (
              <div className="mb-12">
                <div className="bg-slate-800/30 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-gray-100 mb-1">Current Subscription</h2>
                      <p className="text-gray-400 text-sm">
                        Billing period: {new Date(subscriptionStatus.usage.periodStart).toLocaleDateString()} - {new Date(subscriptionStatus.usage.periodEnd).toLocaleDateString()}
                      </p>
                    </div>
                    <div className={`px-4 py-2 rounded-lg bg-gradient-to-r ${tierColors[currentTier]} text-white font-semibold`}>
                      {tierIcons[currentTier]} {subscriptionStatus.tierConfig.displayName}
                    </div>
                  </div>

                  {/* Usage Stats */}
                  <div className="grid md:grid-cols-3 gap-6">
                    {/* Transactions */}
                    <div className="bg-slate-900/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">Monthly Transactions</span>
                        <span className="text-gray-300 text-sm font-mono">
                          {formatNumber(subscriptionStatus.usage.transactions.used)} / {formatNumber(subscriptionStatus.usage.transactions.limit)}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            subscriptionStatus.usage.transactions.percentUsed > 90
                              ? "bg-red-500"
                              : subscriptionStatus.usage.transactions.percentUsed > 70
                              ? "bg-yellow-500"
                              : "bg-cyan-500"
                          }`}
                          style={{
                            width: `${Math.min(subscriptionStatus.usage.transactions.percentUsed, 100)}%`,
                          }}
                        />
                      </div>
                      {subscriptionStatus.usage.transactions.limit !== -1 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {subscriptionStatus.usage.transactions.remaining.toLocaleString()} remaining
                        </p>
                      )}
                    </div>

                    {/* Wallets */}
                    <div className="bg-slate-900/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">Sponsor Wallets</span>
                        <span className="text-gray-300 text-sm font-mono">
                          {subscriptionStatus.usage.wallets.used} / {formatNumber(subscriptionStatus.usage.wallets.limit)}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            subscriptionStatus.usage.wallets.percentUsed > 90
                              ? "bg-red-500"
                              : subscriptionStatus.usage.wallets.percentUsed > 70
                              ? "bg-yellow-500"
                              : "bg-purple-500"
                          }`}
                          style={{
                            width: `${Math.min(subscriptionStatus.usage.wallets.percentUsed, 100)}%`,
                          }}
                        />
                      </div>
                      {subscriptionStatus.usage.wallets.limit !== -1 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {subscriptionStatus.usage.wallets.remaining} remaining
                        </p>
                      )}
                    </div>

                    {/* Rate Limit */}
                    <div className="bg-slate-900/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">Rate Limit</span>
                        <span className="text-gray-300 text-sm font-mono">
                          {subscriptionStatus.limits.rateLimit} req/min
                        </span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full w-full" />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        API access: {subscriptionStatus.limits.apiAccess}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Billing Toggle */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex bg-slate-800/50 border border-blue-500/30 rounded-lg p-1 backdrop-blur-sm">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    billingCycle === "monthly"
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                    billingCycle === "yearly"
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <span>Yearly</span>
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                    Save 17%
                  </span>
                </button>
              </div>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
              </div>
            )}

            {/* Plans Grid */}
            {!isLoading && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {tiers.map((tierName) => {
                  const tier = SUBSCRIPTION_TIERS[tierName];
                  const isCurrentTier = tierName === currentTier;
                  const price = billingCycle === "monthly" ? tier.priceMonthly : tier.priceYearly;
                  const yearlySavings = getYearlySavings(tier.priceMonthly, tier.priceYearly);

                  return (
                    <div
                      key={tierName}
                      className={`relative bg-slate-800/30 border rounded-xl backdrop-blur-sm transition-all duration-300 hover:border-blue-400/50 hover:bg-slate-800/50 ${
                        isCurrentTier
                          ? `${tierBorderColors[tierName]} ring-2 ring-cyan-500/50`
                          : tierBorderColors[tierName]
                      }`}
                    >
                      {/* Current Plan Badge */}
                      {isCurrentTier && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="px-3 py-1 bg-cyan-500 text-white text-xs font-semibold rounded-full">
                            Current Plan
                          </span>
                        </div>
                      )}

                      {/* Popular Badge for Pro */}
                      {tierName === "pro" && !isCurrentTier && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <span className="px-3 py-1 bg-purple-500 text-white text-xs font-semibold rounded-full">
                            Most Popular
                          </span>
                        </div>
                      )}

                      <div className="p-6">
                        {/* Tier Header */}
                        <div className="text-center mb-6">
                          <div className="text-3xl mb-2">{tierIcons[tierName]}</div>
                          <h3 className="text-xl font-bold text-gray-100 mb-1">
                            {tier.displayName}
                          </h3>
                          <p className="text-gray-400 text-sm">{tier.description}</p>
                        </div>

                        {/* Price */}
                        <div className="text-center mb-6">
                          <div className="flex items-baseline justify-center">
                            <span className="text-4xl font-bold text-gray-100">
                              {formatPrice(price)}
                            </span>
                            {price > 0 && (
                              <span className="text-gray-400 ml-1">
                                /{billingCycle === "monthly" ? "mo" : "yr"}
                              </span>
                            )}
                          </div>
                          {billingCycle === "yearly" && yearlySavings > 0 && (
                            <p className="text-green-400 text-sm mt-1">
                              Save {yearlySavings}% vs monthly
                            </p>
                          )}
                        </div>

                        {/* Key Limits */}
                        <div className="space-y-3 mb-6">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Transactions</span>
                            <span className="text-gray-200 font-medium">
                              {formatNumber(tier.limits.monthlyTxLimit)}/mo
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Rate Limit</span>
                            <span className="text-gray-200 font-medium">
                              {tier.limits.rateLimit} req/min
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Sponsor Wallets</span>
                            <span className="text-gray-200 font-medium">
                              {formatNumber(tier.limits.maxWallets)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Rules per Wallet</span>
                            <span className="text-gray-200 font-medium">
                              {formatNumber(tier.limits.maxRulesPerWallet)}
                            </span>
                          </div>
                        </div>

                        {/* Features List */}
                        <div className="border-t border-slate-700/50 pt-4 mb-6">
                          <ul className="space-y-2">
                            {tier.features.map((feature, idx) => (
                              <li key={idx} className="flex items-start text-sm">
                                <span className="text-green-400 mr-2 mt-0.5">✓</span>
                                <span className="text-gray-300">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Action Button */}
                        <div>
                          {isCurrentTier ? (
                            <button
                              disabled
                              className="w-full py-3 px-4 bg-slate-700 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed"
                            >
                              Current Plan
                            </button>
                          ) : tierName === "enterprise" ? (
                            <a
                              href="mailto:enterprise@perkos.xyz?subject=Enterprise Plan Inquiry"
                              className="block w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-lg text-sm font-medium text-center transition-all"
                            >
                              Contact Sales
                            </a>
                          ) : tierName === "free" ? (
                            <a
                              href="mailto:support@perkos.xyz?subject=Downgrade Request"
                              className="block w-full py-3 px-4 bg-slate-700 text-gray-300 hover:bg-slate-600 rounded-lg text-sm font-medium text-center transition-all"
                            >
                              Contact to Downgrade
                            </a>
                          ) : (
                            <button
                              onClick={() => router.push(`/subscription/pay?tier=${tierName}&billing=${billingCycle}`)}
                              className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all bg-gradient-to-r ${tierColors[tierName]} text-white hover:opacity-90`}
                            >
                              Upgrade Now
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Feature Comparison Table */}
            <div className="mt-16">
              <h2 className="text-2xl font-bold text-gray-100 text-center mb-8">
                Feature Comparison
              </h2>
              <div className="bg-slate-800/30 border border-blue-500/20 rounded-xl backdrop-blur-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700/50">
                        <th className="text-left p-4 text-gray-300 font-medium">Feature</th>
                        {tiers.map((tierName) => (
                          <th key={tierName} className="text-center p-4 text-gray-300 font-medium">
                            <span className="mr-1">{tierIcons[tierName]}</span>
                            {SUBSCRIPTION_TIERS[tierName].displayName}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-700/30">
                        <td className="p-4 text-gray-400">Monthly Transactions</td>
                        {tiers.map((tierName) => (
                          <td key={tierName} className="text-center p-4 text-gray-200">
                            {formatNumber(SUBSCRIPTION_TIERS[tierName].limits.monthlyTxLimit)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-700/30 bg-slate-800/20">
                        <td className="p-4 text-gray-400">Rate Limit (req/min)</td>
                        {tiers.map((tierName) => (
                          <td key={tierName} className="text-center p-4 text-gray-200">
                            {SUBSCRIPTION_TIERS[tierName].limits.rateLimit}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-700/30">
                        <td className="p-4 text-gray-400">Sponsor Wallets</td>
                        {tiers.map((tierName) => (
                          <td key={tierName} className="text-center p-4 text-gray-200">
                            {formatNumber(SUBSCRIPTION_TIERS[tierName].limits.maxWallets)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-700/30 bg-slate-800/20">
                        <td className="p-4 text-gray-400">Rules per Wallet</td>
                        {tiers.map((tierName) => (
                          <td key={tierName} className="text-center p-4 text-gray-200">
                            {formatNumber(SUBSCRIPTION_TIERS[tierName].limits.maxRulesPerWallet)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-700/30">
                        <td className="p-4 text-gray-400">API Access</td>
                        {tiers.map((tierName) => (
                          <td key={tierName} className="text-center p-4 text-gray-200 capitalize">
                            {SUBSCRIPTION_TIERS[tierName].limits.apiAccess}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-700/30 bg-slate-800/20">
                        <td className="p-4 text-gray-400">Advanced Analytics</td>
                        {tiers.map((tierName) => (
                          <td key={tierName} className="text-center p-4">
                            {SUBSCRIPTION_TIERS[tierName].limits.advancedAnalytics ? (
                              <span className="text-green-400">✓</span>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-700/30">
                        <td className="p-4 text-gray-400">Priority Support</td>
                        {tiers.map((tierName) => (
                          <td key={tierName} className="text-center p-4">
                            {SUBSCRIPTION_TIERS[tierName].limits.prioritySupport ? (
                              <span className="text-green-400">✓</span>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-700/30 bg-slate-800/20">
                        <td className="p-4 text-gray-400">Custom Branding</td>
                        {tiers.map((tierName) => (
                          <td key={tierName} className="text-center p-4">
                            {SUBSCRIPTION_TIERS[tierName].limits.customBranding ? (
                              <span className="text-green-400">✓</span>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-700/30">
                        <td className="p-4 text-gray-400">Webhooks</td>
                        {tiers.map((tierName) => (
                          <td key={tierName} className="text-center p-4">
                            {SUBSCRIPTION_TIERS[tierName].limits.webhooks ? (
                              <span className="text-green-400">✓</span>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-700/30 bg-slate-800/20">
                        <td className="p-4 text-gray-400">Batch Settlement</td>
                        {tiers.map((tierName) => (
                          <td key={tierName} className="text-center p-4">
                            {SUBSCRIPTION_TIERS[tierName].limits.batchSettlement ? (
                              <span className="text-green-400">✓</span>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-4 text-gray-400">Custom SLA</td>
                        {tiers.map((tierName) => (
                          <td key={tierName} className="text-center p-4">
                            {SUBSCRIPTION_TIERS[tierName].limits.customSLA ? (
                              <span className="text-green-400">✓</span>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* FAQ Section */}
            <div className="mt-16">
              <h2 className="text-2xl font-bold text-gray-100 text-center mb-8">
                Frequently Asked Questions
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-800/30 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm">
                  <h3 className="text-lg font-semibold text-gray-100 mb-2">
                    What happens if I exceed my limits?
                  </h3>
                  <p className="text-gray-400 text-sm">
                    You&apos;ll receive a warning when approaching your limits. Once exceeded,
                    API requests will return a 402 Payment Required or 429 Too Many Requests
                    response. Consider upgrading to continue operations.
                  </p>
                </div>
                <div className="bg-slate-800/30 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm">
                  <h3 className="text-lg font-semibold text-gray-100 mb-2">
                    Can I change plans at any time?
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Yes! You can upgrade or downgrade your plan at any time. Upgrades
                    take effect immediately, while downgrades apply at the end of your
                    current billing cycle.
                  </p>
                </div>
                <div className="bg-slate-800/30 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm">
                  <h3 className="text-lg font-semibold text-gray-100 mb-2">
                    Which networks are supported?
                  </h3>
                  <p className="text-gray-400 text-sm">
                    All plans include access to all supported networks: Avalanche, Base,
                    Celo, and their respective testnets. Network access is not limited
                    by subscription tier.
                  </p>
                </div>
                <div className="bg-slate-800/30 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm">
                  <h3 className="text-lg font-semibold text-gray-100 mb-2">
                    How does billing work?
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Billing is processed at the beginning of each billing cycle. You can
                    choose between monthly or yearly billing, with yearly plans offering
                    approximately 17% savings.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            {!isConnected && (
              <div className="mt-16 text-center">
                <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl p-8 backdrop-blur-sm">
                  <h2 className="text-2xl font-bold text-gray-100 mb-4">
                    Ready to get started?
                  </h2>
                  <p className="text-gray-400 mb-6">
                    Sign in to view your current usage and manage your subscription.
                  </p>
                  <button
                    onClick={() => {}}
                    className="px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-lg transition-all"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <Footer />
      </div>

    </div>
  );
}
