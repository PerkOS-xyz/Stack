"use client";

import Link from "next/link";
import { SUBSCRIPTION_TIERS, type SubscriptionTier } from "@/lib/config/subscriptions";

interface PlanCardProps {
  tier: SubscriptionTier;
  isPopular?: boolean;
  compact?: boolean;
}

function PlanCard({ tier, isPopular, compact }: PlanCardProps) {
  const config = SUBSCRIPTION_TIERS[tier];
  const isEnterprise = tier === "enterprise";
  const isFree = tier === "free";

  // Tier-specific styling
  const getTierGradient = () => {
    switch (tier) {
      case "enterprise":
        return "from-purple-500 to-pink-500";
      case "scale":
        return "from-orange-500 to-red-500";
      case "pro":
        return "from-blue-500 to-cyan-500";
      case "starter":
        return "from-green-500 to-emerald-500";
      default:
        return "from-gray-500 to-gray-400";
    }
  };

  const getCardStyle = () => {
    if (isPopular) {
      return "border-cyan-400/60 ring-2 ring-cyan-400/30 bg-slate-800/70 scale-[1.02] lg:scale-105";
    }
    return "border-blue-500/30 bg-slate-800/50";
  };

  const featureCount = compact ? 4 : 6;

  return (
    <div
      className={`relative ${getCardStyle()} border rounded-2xl p-5 lg:p-6 backdrop-blur-sm hover:border-blue-400/50 transition-all duration-300 flex flex-col h-full min-w-[280px] sm:min-w-0`}
    >
      {/* Popular Badge */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
          <span className="px-3 py-1 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-bold rounded-full shadow-lg shadow-cyan-500/30 whitespace-nowrap">
            Most Popular
          </span>
        </div>
      )}

      {/* Header */}
      <div className={`${isPopular ? "pt-2" : ""}`}>
        <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-3 bg-gradient-to-r ${getTierGradient()} text-white`}>
          {config.displayName}
        </div>
        <p className="text-sm text-gray-400 mb-4 line-clamp-2 min-h-[40px]">{config.description}</p>

        {/* Price */}
        <div className="mb-1">
          {isEnterprise ? (
            <div className="flex items-baseline">
              <span className="text-3xl lg:text-4xl font-bold text-gray-100">Custom</span>
            </div>
          ) : isFree ? (
            <div className="flex items-baseline">
              <span className="text-3xl lg:text-4xl font-bold text-gray-100">$0</span>
              <span className="text-gray-500 ml-1 text-sm">/forever</span>
            </div>
          ) : (
            <div className="flex items-baseline">
              <span className="text-3xl lg:text-4xl font-bold text-gray-100">${config.priceMonthly}</span>
              <span className="text-gray-400 ml-1">/mo</span>
            </div>
          )}
        </div>
        {!isEnterprise && !isFree && (
          <p className="text-xs text-gray-500 mb-4">
            ${config.priceYearly}/yr <span className="text-green-400">(save {Math.round((1 - config.priceYearly / (config.priceMonthly * 12)) * 100)}%)</span>
          </p>
        )}
        {(isEnterprise || isFree) && <div className="h-5 mb-4" />}
      </div>

      {/* Divider */}
      <div className="border-t border-slate-700/50 my-3" />

      {/* Features */}
      <div className="flex-1 mb-4">
        <ul className="space-y-2.5">
          {config.features.slice(0, featureCount).map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <svg className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-gray-300 leading-tight">{feature}</span>
            </li>
          ))}
          {config.features.length > featureCount && (
            <li className="text-xs text-cyan-400/70 pl-6 pt-1">
              +{config.features.length - featureCount} more features
            </li>
          )}
        </ul>
      </div>

      {/* CTA Button */}
      <Link
        href="/subscription"
        className={`block w-full py-3 px-4 rounded-xl text-center font-semibold transition-all duration-200 ${
          isPopular
            ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40"
            : isFree
            ? "bg-slate-700/50 text-gray-300 hover:bg-slate-600/50 border border-slate-600"
            : isEnterprise
            ? "bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-400 hover:from-purple-600/30 hover:to-pink-600/30 border border-purple-500/30"
            : "bg-gradient-to-r from-blue-600/20 to-cyan-600/20 text-cyan-400 hover:from-blue-600/30 hover:to-cyan-600/30 border border-blue-500/30"
        }`}
      >
        {isEnterprise ? "Contact Sales" : isFree ? "Get Started Free" : "Upgrade Now"}
      </Link>
    </div>
  );
}

export function SubscriptionPlans() {
  const tiers: SubscriptionTier[] = ["free", "starter", "pro", "scale", "enterprise"];

  return (
    <section className="container mx-auto px-4 py-12 lg:py-16">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 lg:mb-12">
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 text-gray-100">
            Simple, Transparent Pricing
          </h3>
          <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base">
            Choose the plan that fits your needs. All plans include full multi-chain access.
          </p>
        </div>

        {/* Mobile: Horizontal scroll */}
        <div className="lg:hidden -mx-4 px-4 overflow-x-auto pb-4 scrollbar-hide">
          <div className="flex gap-4 w-max">
            {tiers.map((tier) => (
              <div key={tier} className="w-[280px] flex-shrink-0">
                <PlanCard
                  tier={tier}
                  isPopular={tier === "pro"}
                  compact
                />
              </div>
            ))}
          </div>
          {/* Scroll indicator */}
          <div className="flex justify-center mt-4 gap-1.5">
            {tiers.map((tier, idx) => (
              <div
                key={tier}
                className={`w-2 h-2 rounded-full ${idx === 2 ? "bg-cyan-400" : "bg-slate-600"}`}
              />
            ))}
          </div>
        </div>

        {/* Desktop: Grid layout */}
        <div className="hidden lg:grid lg:grid-cols-5 gap-4 xl:gap-6 items-stretch">
          {tiers.map((tier) => (
            <PlanCard
              key={tier}
              tier={tier}
              isPopular={tier === "pro"}
            />
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-8 lg:mt-12 text-center">
          <p className="text-xs sm:text-sm text-gray-400 mb-4">
            All paid plans include 14-day free trial. No credit card required.
          </p>
          {/* Trust badges - responsive */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-gray-300">Secure USDC</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-gray-300">Instant activation</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-gray-300">Cancel anytime</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SubscriptionPlans;
