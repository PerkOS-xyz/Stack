'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useSubscription } from '@/lib/hooks/useSubscription';
import { getActivePlans, getPlanPriceDisplay, type PlanId } from '@/lib/config/access-plans';

export default function PlansPage() {
  const router = useRouter();
  const { isConnected, isRegistered, isLoading: subscriptionLoading, register, walletAddress } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plans = getActivePlans();

  // If user is already registered, redirect to dashboard
  if (isRegistered && !subscriptionLoading) {
    router.push('/dashboard');
    return null;
  }

  const handleSelectPlan = async (planId: PlanId) => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    // Enterprise requires contact
    if (planId === 'enterprise') {
      window.location.href = 'mailto:support@perkos.io?subject=Enterprise Plan Inquiry';
      return;
    }

    // For paid plans, show payment flow (TODO: implement payment)
    if (planId !== 'free') {
      setError('Paid plans coming soon. Please select the Free plan to get started.');
      return;
    }

    setSelectedPlan(planId);
    setIsRegistering(true);
    setError(null);

    try {
      const success = await register(planId);
      if (success) {
        router.push('/dashboard');
      } else {
        setError('Registration failed. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <Header />

      <main className="container mx-auto px-4 py-12">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Choose Your Plan
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Select a plan that fits your needs. All plans include access to our x402 payment infrastructure.
          </p>
          {!isConnected && (
            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg inline-block">
              <p className="text-yellow-400">
                Please connect your wallet to continue
              </p>
            </div>
          )}
          {isConnected && walletAddress && (
            <div className="mt-4 text-sm text-gray-500">
              Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="max-w-4xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-center">{error}</p>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl mx-auto">
          {plans.map((plan) => {
            const isPopular = plan.id === 'pro';
            const isEnterprise = plan.id === 'enterprise';
            const isFree = plan.id === 'free';
            const isSelected = selectedPlan === plan.id;
            const isProcessing = isRegistering && isSelected;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border transition-all duration-300 ${
                  isPopular
                    ? 'border-cyan-500/50 bg-gradient-to-b from-cyan-500/10 to-slate-800/50 scale-105 shadow-lg shadow-cyan-500/20'
                    : 'border-blue-500/20 bg-slate-800/30 hover:border-blue-500/40 hover:bg-slate-800/50'
                } ${isEnterprise ? 'lg:col-span-1' : ''}`}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-medium rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="p-6">
                  {/* Plan Header */}
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                    <p className="text-sm text-gray-400 mb-4 min-h-[40px]">{plan.description}</p>
                    <div className="text-3xl font-bold">
                      <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                        {getPlanPriceDisplay(plan.id)}
                      </span>
                    </div>
                    {plan.priceUsd !== 'custom' && plan.priceUsd !== '0' && (
                      <p className="text-xs text-gray-500 mt-1">per month</p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start text-sm">
                        <svg
                          className="w-5 h-5 text-cyan-400 mr-2 flex-shrink-0 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* SLA Badge */}
                  {plan.slaGuarantee && (
                    <div className="mb-4 text-center">
                      <span className="px-3 py-1 bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium rounded-full">
                        {plan.slaGuarantee} SLA
                      </span>
                    </div>
                  )}

                  {/* CTA Button */}
                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={!isConnected || isProcessing || subscriptionLoading}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      isPopular
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600'
                        : isEnterprise
                        ? 'bg-slate-700 text-white hover:bg-slate-600'
                        : isFree
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30'
                        : 'bg-slate-700 text-white hover:bg-slate-600'
                    }`}
                  >
                    {isProcessing ? (
                      <span className="flex items-center justify-center">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-5 w-5"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Registering...
                      </span>
                    ) : isEnterprise ? (
                      'Contact Sales'
                    ) : isFree ? (
                      'Get Started Free'
                    ) : (
                      'Coming Soon'
                    )}
                  </button>

                  {/* Support Level */}
                  <p className="text-center text-xs text-gray-500 mt-3">
                    {plan.supportLevel.charAt(0).toUpperCase() + plan.supportLevel.slice(1)} support
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Additional Info */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-white mb-6">Why Choose Stack?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="p-6 bg-slate-800/30 rounded-xl border border-blue-500/20">
              <div className="text-3xl mb-4">🔗</div>
              <h3 className="text-lg font-semibold text-white mb-2">Multi-Chain Support</h3>
              <p className="text-gray-400 text-sm">
                Seamless payments across Base, Avalanche, and more networks.
              </p>
            </div>
            <div className="p-6 bg-slate-800/30 rounded-xl border border-blue-500/20">
              <div className="text-3xl mb-4">💰</div>
              <h3 className="text-lg font-semibold text-white mb-2">x402 Protocol</h3>
              <p className="text-gray-400 text-sm">
                Industry-standard payment verification and settlement.
              </p>
            </div>
            <div className="p-6 bg-slate-800/30 rounded-xl border border-blue-500/20">
              <div className="text-3xl mb-4">🔐</div>
              <h3 className="text-lg font-semibold text-white mb-2">Wallet-Based Auth</h3>
              <p className="text-gray-400 text-sm">
                No API keys needed. Just connect your wallet to get started.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div className="p-4 bg-slate-800/30 rounded-lg border border-blue-500/20">
              <h3 className="font-semibold text-white mb-2">How does wallet-based authentication work?</h3>
              <p className="text-gray-400 text-sm">
                Your wallet address identifies you in the x402 protocol. When you make API calls through x402,
                your wallet signs the payment payload, which verifies your identity automatically.
              </p>
            </div>
            <div className="p-4 bg-slate-800/30 rounded-lg border border-blue-500/20">
              <h3 className="font-semibold text-white mb-2">What counts as a transaction?</h3>
              <p className="text-gray-400 text-sm">
                Each x402 verify or settle API call counts as one transaction. Rate limits apply per minute
                while monthly limits apply to total transactions.
              </p>
            </div>
            <div className="p-4 bg-slate-800/30 rounded-lg border border-blue-500/20">
              <h3 className="font-semibold text-white mb-2">Can I upgrade my plan later?</h3>
              <p className="text-gray-400 text-sm">
                Yes! You can upgrade your plan at any time from your dashboard. Your new limits will take
                effect immediately.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
