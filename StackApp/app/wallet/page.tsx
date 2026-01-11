'use client';

import { useState, useEffect, useRef } from 'react';

export const dynamic = "force-dynamic";
import { useWallet } from "@getpara/react-sdk";
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { toast, Toaster } from 'sonner';
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Link from 'next/link';

interface SponsorWallet {
  id: string;
  network: string;
  sponsor_address: string;
  smart_wallet_address: string | null;
  balance: string;
  created_at: string;
  wallet_name?: string;
  para_user_share?: string;
}

interface NetworkConfig {
  name: string;
  symbol: string;
  icon: string;
  chainId: number;
  explorer: string;
  isTestnet?: boolean;
}

const networks: Record<string, NetworkConfig> = {
  // Mainnets
  'avalanche': { name: 'Avalanche', symbol: 'AVAX', icon: '🔺', chainId: 43114, explorer: 'https://snowtrace.io' },
  'base': { name: 'Base', symbol: 'ETH', icon: '🔵', chainId: 8453, explorer: 'https://basescan.org' },
  'celo': { name: 'Celo', symbol: 'CELO', icon: '🟢', chainId: 42220, explorer: 'https://celoscan.io' },
  'ethereum': { name: 'Ethereum', symbol: 'ETH', icon: '💎', chainId: 1, explorer: 'https://etherscan.io' },
  'polygon': { name: 'Polygon', symbol: 'POL', icon: '🟣', chainId: 137, explorer: 'https://polygonscan.com' },
  'arbitrum': { name: 'Arbitrum', symbol: 'ETH', icon: '🔷', chainId: 42161, explorer: 'https://arbiscan.io' },
  'optimism': { name: 'Optimism', symbol: 'ETH', icon: '🔴', chainId: 10, explorer: 'https://optimistic.etherscan.io' },
  'monad': { name: 'Monad', symbol: 'MON', icon: '🟡', chainId: 10142, explorer: 'https://monadexplorer.com' },
  // Testnets
  'avalanche-fuji': { name: 'Avalanche Fuji', symbol: 'AVAX', icon: '🔺', chainId: 43113, explorer: 'https://testnet.snowtrace.io', isTestnet: true },
  'base-sepolia': { name: 'Base Sepolia', symbol: 'ETH', icon: '🔵', chainId: 84532, explorer: 'https://sepolia.basescan.org', isTestnet: true },
  'celo-sepolia': { name: 'Celo Alfajores', symbol: 'CELO', icon: '🟢', chainId: 11142220, explorer: 'https://celo-sepolia.blockscout.com', isTestnet: true },
  'sepolia': { name: 'Sepolia', symbol: 'ETH', icon: '💎', chainId: 11155111, explorer: 'https://sepolia.etherscan.io', isTestnet: true },
  'polygon-amoy': { name: 'Polygon Amoy', symbol: 'POL', icon: '🟣', chainId: 80002, explorer: 'https://amoy.polygonscan.com', isTestnet: true },
  'arbitrum-sepolia': { name: 'Arbitrum Sepolia', symbol: 'ETH', icon: '🔷', chainId: 421614, explorer: 'https://sepolia.arbiscan.io', isTestnet: true },
  'optimism-sepolia': { name: 'OP Sepolia', symbol: 'ETH', icon: '🔴', chainId: 11155420, explorer: 'https://sepolia-optimism.etherscan.io', isTestnet: true },
  'monad-testnet': { name: 'Monad Testnet', symbol: 'MON', icon: '🟡', chainId: 10143, explorer: 'https://testnet.monadexplorer.com', isTestnet: true },
};

export default function WalletPage() {
  const { data: connectedWallet } = useWallet();
  const address = connectedWallet?.address;
  const isConnected = !!connectedWallet;

  const [allWallets, setAllWallets] = useState<SponsorWallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'main' | 'receive' | 'send'>('main');
  const [sendAddress, setSendAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('avalanche');
  const [sending, setSending] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [networkBalances, setNetworkBalances] = useState<Record<string, { balance: string; symbol: string; loading: boolean }>>({});
  const [showNetworkSelector, setShowNetworkSelector] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  // Get currently selected wallet
  const sponsorWallet = allWallets.find(w => w.id === selectedWalletId) || null;

  useEffect(() => {
    if (isConnected && address) {
      loadWallet();
    }
  }, [isConnected, address]);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const loadWallet = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/sponsor/wallets?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        if (data.wallets && data.wallets.length > 0) {
          setAllWallets(data.wallets);
          // Select first wallet if none selected, or keep current selection
          if (!selectedWalletId || !data.wallets.find((w: SponsorWallet) => w.id === selectedWalletId)) {
            setSelectedWalletId(data.wallets[0].id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNetworkBalance = async (network: string) => {
    if (!sponsorWallet) return;

    setNetworkBalances(prev => ({
      ...prev,
      [network]: { ...prev[network], loading: true }
    }));

    try {
      const response = await fetch(
        `/api/sponsor/wallets/balance-by-network?address=${sponsorWallet.sponsor_address}&network=${network}`
      );
      if (response.ok) {
        const data = await response.json();
        setNetworkBalances(prev => ({
          ...prev,
          [network]: {
            balance: data.balance,
            symbol: data.symbol,
            loading: false
          }
        }));
      }
    } catch (error) {
      console.error(`Failed to fetch balance for ${network}:`, error);
      setNetworkBalances(prev => ({
        ...prev,
        [network]: { ...prev[network], loading: false }
      }));
    }
  };

  useEffect(() => {
    if (sponsorWallet && selectedNetwork) {
      fetchNetworkBalance(selectedNetwork);
    }
  }, [sponsorWallet, selectedNetwork]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const formatBalanceCompact = (balanceWei: string) => {
    const balance = Number(balanceWei) / 1e18;
    if (balance === 0) return '0.00';
    if (balance < 0.01) return balance.toFixed(6);
    if (balance < 1) return balance.toFixed(4);
    if (balance < 1000) return balance.toFixed(2);
    return balance.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const handleSend = async () => {
    if (!sponsorWallet || !sendAddress || !sendAmount) {
      toast.error('Please enter recipient address and amount');
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(sendAddress)) {
      toast.error('Invalid wallet address');
      return;
    }

    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount');
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/sponsor/wallets/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: sponsorWallet.id,
          toAddress: sendAddress,
          amount: sendAmount,
          network: selectedNetwork,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Transaction sent!');
        setSendAddress('');
        setSendAmount('');
        setActiveView('main');
        await loadWallet();
        fetchNetworkBalance(selectedNetwork);
      } else if (data.isLegacyWallet) {
        toast.error('This legacy wallet cannot sign transactions. Please create a new wallet.');
      } else {
        toast.error(data.error || 'Transaction failed');
      }
    } catch (error) {
      console.error('Failed to send transaction:', error);
      toast.error('Transaction failed');
    } finally {
      setSending(false);
    }
  };

  const startScanner = async () => {
    if (!scannerContainerRef.current) return;

    setShowScanner(true);
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const html5QrCode = new Html5Qrcode("qr-scanner");
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          let addr = decodedText;
          if (decodedText.startsWith('ethereum:')) {
            addr = decodedText.replace('ethereum:', '').split('@')[0].split('?')[0];
          }
          if (/^0x[a-fA-F0-9]{40}$/.test(addr)) {
            setSendAddress(addr);
            toast.success('Address scanned');
            stopScanner();
          } else {
            toast.error('Invalid QR code');
          }
        },
        () => {}
      );
    } catch (error) {
      console.error('Failed to start scanner:', error);
      toast.error('Camera access denied');
      setShowScanner(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (error) {
        console.error('Error stopping scanner:', error);
      }
    }
    setShowScanner(false);
  };

  const getNetworkBalance = (network: string) => {
    const balanceData = networkBalances[network];
    if (!balanceData) return { balance: '0', symbol: networks[network]?.symbol || 'ETH', loading: false };
    return balanceData;
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col">
        <Header />
        <main className="flex items-center justify-center flex-1">
          <div className="text-center p-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center backdrop-blur-sm">
              <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-white mb-2">Connect Wallet</h1>
            <p className="text-gray-400 text-sm">Connect your wallet to continue</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col">
        <Header />
        <main className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Loading wallet...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // No wallet state
  if (allWallets.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col">
        <Header />
        <main className="flex items-center justify-center flex-1">
          <div className="text-center p-8 max-w-sm">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
              <svg className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">No Wallet Found</h1>
            <p className="text-gray-400 text-sm mb-6">Create a sponsor wallet from your dashboard</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-500/25"
            >
              Go to Dashboard
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // If no wallet is selected yet, show loading
  if (!sponsorWallet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col">
        <Header />
        <main className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Loading wallet...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const currentBalance = getNetworkBalance(selectedNetwork);
  const currentNetwork = networks[selectedNetwork];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col">
      <Header />
      <Toaster position="top-center" theme="dark" />

      <main className="container mx-auto px-4 py-6 max-w-md flex-1">
        {/* Main Wallet View */}
        {activeView === 'main' && (
          <div className="space-y-4">
            {/* Wallet Card - Metallic Glass Effect */}
            <div className="relative overflow-hidden rounded-3xl">
              {/* Metallic gradient border */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/50 via-blue-500/30 to-blue-600/50 rounded-3xl" />
              <div className="absolute inset-[1px] bg-gradient-to-br from-slate-800/95 via-slate-900/95 to-blue-950/95 rounded-3xl" />

              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent rounded-3xl" />

              {/* Content */}
              <div className="relative p-6">
                {/* Top Row: Wallet Selector (left) + Network Selector (right) */}
                <div className="flex items-start justify-between gap-3 mb-8">
                  {/* Wallet Selector (Left) */}
                  <div className="relative flex-1 min-w-0">
                    {allWallets.length > 1 ? (
                      <>
                        <button
                          onClick={() => setShowWalletSelector(!showWalletSelector)}
                          className="flex items-center space-x-2 px-3 py-2.5 rounded-xl bg-slate-800/80 border border-purple-500/20 hover:border-purple-500/40 transition-all backdrop-blur-sm"
                        >
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                          </div>
                          <div className="text-left min-w-0">
                            <p className="text-sm text-white font-medium truncate">{sponsorWallet?.wallet_name || 'Sponsor Wallet'}</p>
                            <p className="text-[10px] text-gray-500 font-mono">{sponsorWallet ? truncateAddress(sponsorWallet.sponsor_address) : ''}</p>
                          </div>
                          <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${showWalletSelector ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Wallet Dropdown */}
                        {showWalletSelector && (
                          <div className="absolute top-full left-0 mt-2 w-64 py-2 bg-slate-800/95 border border-purple-500/20 rounded-2xl shadow-2xl shadow-black/50 z-50 max-h-60 overflow-y-auto backdrop-blur-xl">
                            <div className="px-4 py-2 text-xs text-purple-400 uppercase tracking-wider font-medium">Your Wallets</div>
                            {allWallets.map((wallet) => (
                              <button
                                key={wallet.id}
                                onClick={() => {
                                  setSelectedWalletId(wallet.id);
                                  setShowWalletSelector(false);
                                  setNetworkBalances({});
                                }}
                                className={`w-full flex items-center space-x-3 px-4 py-3 hover:bg-purple-500/10 transition-colors ${selectedWalletId === wallet.id ? 'bg-purple-500/10' : ''}`}
                              >
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                                  <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                  </svg>
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                  <p className="text-sm text-white font-medium truncate">{wallet.wallet_name || 'Sponsor Wallet'}</p>
                                  <p className="text-[10px] text-gray-500 font-mono">{truncateAddress(wallet.sponsor_address)}</p>
                                </div>
                                {!wallet.para_user_share && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex-shrink-0">Legacy</span>
                                )}
                                {selectedWalletId === wallet.id && (
                                  <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center space-x-2 px-3 py-2.5 rounded-xl bg-slate-800/80 border border-purple-500/20 backdrop-blur-sm">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-sm text-white font-medium truncate">{sponsorWallet?.wallet_name || 'Sponsor Wallet'}</p>
                          <p className="text-[10px] text-gray-500 font-mono">{sponsorWallet ? truncateAddress(sponsorWallet.sponsor_address) : ''}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Network Selector (Right) */}
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setShowNetworkSelector(!showNetworkSelector)}
                      className="flex items-center space-x-2 px-3 py-2.5 rounded-xl bg-slate-800/80 border border-blue-500/20 hover:border-cyan-500/40 transition-all backdrop-blur-sm"
                    >
                      <span className="text-lg">{currentNetwork?.icon}</span>
                      <span className="text-sm text-white font-medium">{currentNetwork?.name}</span>
                      {currentNetwork?.isTestnet && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">TEST</span>
                      )}
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${showNetworkSelector ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Network Dropdown */}
                    {showNetworkSelector && (
                      <div className="absolute top-full right-0 mt-2 w-64 py-2 bg-slate-800/95 border border-blue-500/20 rounded-2xl shadow-2xl shadow-black/50 z-50 max-h-80 overflow-y-auto backdrop-blur-xl">
                        <div className="px-4 py-2 text-xs text-cyan-400 uppercase tracking-wider font-medium">Mainnets</div>
                        {Object.entries(networks).filter(([, n]) => !n.isTestnet).map(([key, net]) => (
                          <button
                            key={key}
                            onClick={() => {
                              setSelectedNetwork(key);
                              setShowNetworkSelector(false);
                            }}
                            className={`w-full flex items-center space-x-3 px-4 py-2.5 hover:bg-blue-500/10 transition-colors ${selectedNetwork === key ? 'bg-blue-500/10' : ''}`}
                          >
                            <span className="text-lg">{net.icon}</span>
                            <span className="text-sm text-white flex-1 text-left">{net.name}</span>
                            {selectedNetwork === key && (
                              <svg className="w-4 h-4 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        ))}
                        <div className="px-4 py-2 text-xs text-cyan-400 uppercase tracking-wider font-medium border-t border-blue-500/10 mt-2">Testnets</div>
                        {Object.entries(networks).filter(([, n]) => n.isTestnet).map(([key, net]) => (
                          <button
                            key={key}
                            onClick={() => {
                              setSelectedNetwork(key);
                              setShowNetworkSelector(false);
                            }}
                            className={`w-full flex items-center space-x-3 px-4 py-2.5 hover:bg-blue-500/10 transition-colors ${selectedNetwork === key ? 'bg-blue-500/10' : ''}`}
                          >
                            <span className="text-lg">{net.icon}</span>
                            <span className="text-sm text-white flex-1 text-left">{net.name}</span>
                            {selectedNetwork === key && (
                              <svg className="w-4 h-4 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Balance Display */}
                <div className="text-center mb-8">
                  <p className="text-sm text-gray-400 mb-2">Total Balance</p>
                  {currentBalance.loading ? (
                    <div className="h-14 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <>
                      <h2 className="text-5xl font-bold bg-gradient-to-r from-white via-cyan-200 to-white bg-clip-text text-transparent tracking-tight mb-1">
                        {formatBalanceCompact(currentBalance.balance)}
                      </h2>
                      <p className="text-lg text-cyan-400 font-medium">{currentBalance.symbol}</p>
                    </>
                  )}
                </div>

                {/* Address Pill */}
                <div className="flex items-center justify-center mb-8">
                  <button
                    onClick={() => copyToClipboard(sponsorWallet.sponsor_address)}
                    className="flex items-center space-x-2 px-4 py-2 rounded-full bg-slate-800/60 border border-blue-500/20 hover:border-cyan-500/40 transition-all group"
                  >
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm text-gray-300 font-mono">{truncateAddress(sponsorWallet.sponsor_address)}</span>
                    <svg className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setActiveView('receive')}
                    className="flex flex-col items-center justify-center py-4 rounded-2xl bg-gradient-to-b from-slate-700/50 to-slate-800/50 border border-blue-500/20 hover:border-cyan-500/40 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-white">Receive</span>
                  </button>

                  <button
                    onClick={() => setActiveView('send')}
                    className="flex flex-col items-center justify-center py-4 rounded-2xl bg-gradient-to-b from-slate-700/50 to-slate-800/50 border border-blue-500/20 hover:border-cyan-500/40 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-white">Send</span>
                  </button>

                  <a
                    href={`${currentNetwork?.explorer}/address/${sponsorWallet.sponsor_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center py-4 rounded-2xl bg-gradient-to-b from-slate-700/50 to-slate-800/50 border border-blue-500/20 hover:border-cyan-500/40 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-white">Explorer</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-slate-800/50 border border-blue-500/20 rounded-2xl overflow-hidden backdrop-blur-sm">
              <Link
                href="/dashboard"
                className="flex items-center justify-between p-4 hover:bg-blue-500/5 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Dashboard</p>
                    <p className="text-xs text-gray-500">Manage your services & sponsorships</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* Activity Section */}
            <div className="bg-slate-800/50 border border-blue-500/20 rounded-2xl p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white">Recent Activity</h3>
                <span className="text-xs text-cyan-400">View all</span>
              </div>
              <div className="text-center py-8">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-700/50 border border-blue-500/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">No recent transactions</p>
              </div>
            </div>
          </div>
        )}

        {/* Receive View */}
        {activeView === 'receive' && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setActiveView('main')}
                className="p-2 rounded-xl bg-slate-800/50 border border-blue-500/20 hover:border-cyan-500/40 transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-white">Receive</h1>
              <div className="w-10" />
            </div>

            {/* QR Card */}
            <div className="relative overflow-hidden rounded-3xl">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/30 via-blue-500/20 to-blue-600/30 rounded-3xl" />
              <div className="absolute inset-[1px] bg-gradient-to-br from-slate-800/98 via-slate-900/98 to-blue-950/98 rounded-3xl" />

              <div className="relative p-6">
                {/* Network Badge */}
                <div className="flex items-center justify-center mb-6">
                  <div className="flex items-center space-x-2 px-4 py-2 rounded-full bg-slate-800/80 border border-blue-500/20">
                    <span className="text-lg">{currentNetwork?.icon}</span>
                    <span className="text-sm text-white font-medium">{currentNetwork?.name}</span>
                  </div>
                </div>

                {/* QR Code with metallic frame */}
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/50 to-blue-500/50 rounded-2xl blur-sm" />
                    <div className="relative p-1 bg-gradient-to-br from-cyan-500/30 via-blue-500/20 to-cyan-500/30 rounded-2xl">
                      <div className="p-4 bg-white rounded-xl">
                        <QRCodeSVG
                          value={`ethereum:${sponsorWallet.sponsor_address}@${currentNetwork?.chainId || 1}`}
                          size={180}
                          level="H"
                          includeMargin={false}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="text-center mb-6">
                  <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Your Address</p>
                  <p className="text-sm font-mono text-cyan-400 break-all px-2">{sponsorWallet.sponsor_address}</p>
                </div>

                {/* Copy Button */}
                <button
                  onClick={() => copyToClipboard(sponsorWallet.sponsor_address)}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-2xl transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Copy Address</span>
                </button>
              </div>
            </div>

            {/* Info Card */}
            <div className="bg-slate-800/50 border border-amber-500/20 rounded-2xl p-4 backdrop-blur-sm">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-white mb-1">Only send <span className="text-cyan-400 font-medium">{currentNetwork?.symbol}</span> on <span className="text-cyan-400 font-medium">{currentNetwork?.name}</span></p>
                  <p className="text-xs text-gray-500">Sending other assets may result in permanent loss</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Send View */}
        {activeView === 'send' && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setActiveView('main')}
                className="p-2 rounded-xl bg-slate-800/50 border border-blue-500/20 hover:border-cyan-500/40 transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-white">Send</h1>
              <div className="w-10" />
            </div>

            {/* From Wallet Card */}
            <div className="relative overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/30 via-blue-500/20 to-purple-600/30 rounded-2xl" />
              <div className="absolute inset-[1px] bg-gradient-to-br from-slate-800/98 via-slate-900/98 to-purple-950/98 rounded-2xl" />
              <div className="relative p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">From Wallet</p>
                      <p className="text-white font-medium">
                        {sponsorWallet?.wallet_name || 'Sponsor Wallet'}
                        {!sponsorWallet?.para_user_share && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Legacy</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Address</p>
                    <p className="text-cyan-400 font-mono text-sm">
                      {sponsorWallet?.sponsor_address?.slice(0, 6)}...{sponsorWallet?.sponsor_address?.slice(-4)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Send Form Card */}
            <div className="relative overflow-hidden rounded-3xl">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 via-cyan-500/20 to-blue-600/30 rounded-3xl" />
              <div className="absolute inset-[1px] bg-gradient-to-br from-slate-800/98 via-slate-900/98 to-blue-950/98 rounded-3xl" />

              <div className="relative p-6 space-y-5">
                {/* Network Selector */}
                <div>
                  <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Network</label>
                  <button
                    onClick={() => setShowNetworkSelector(!showNetworkSelector)}
                    className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-slate-800/60 border border-blue-500/20 hover:border-cyan-500/40 transition-all"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{currentNetwork?.icon}</span>
                      <span className="text-white font-medium">{currentNetwork?.name}</span>
                      {currentNetwork?.isTestnet && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">TEST</span>
                      )}
                    </div>
                    <svg className={`w-5 h-5 text-gray-400 transition-transform ${showNetworkSelector ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showNetworkSelector && (
                    <div className="mt-2 py-2 bg-slate-800/95 border border-blue-500/20 rounded-2xl shadow-2xl shadow-black/50 max-h-60 overflow-y-auto backdrop-blur-xl">
                      {Object.entries(networks).map(([key, net]) => (
                        <button
                          key={key}
                          onClick={() => {
                            setSelectedNetwork(key);
                            setShowNetworkSelector(false);
                          }}
                          className={`w-full flex items-center space-x-3 px-4 py-3 hover:bg-blue-500/10 transition-colors ${selectedNetwork === key ? 'bg-blue-500/10' : ''}`}
                        >
                          <span className="text-lg">{net.icon}</span>
                          <span className="text-sm text-white flex-1 text-left">{net.name}</span>
                          {net.isTestnet && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">TEST</span>
                          )}
                          {selectedNetwork === key && (
                            <svg className="w-4 h-4 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Available Balance */}
                <div className="px-4 py-3 rounded-xl bg-slate-700/30 border border-blue-500/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Available Balance</span>
                    <span className="text-sm text-cyan-400 font-medium">
                      {currentBalance.loading ? (
                        <span className="text-gray-500">Loading...</span>
                      ) : (
                        `${formatBalanceCompact(currentBalance.balance)} ${currentBalance.symbol}`
                      )}
                    </span>
                  </div>
                </div>

                {/* Recipient */}
                <div>
                  <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Recipient Address</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={sendAddress}
                      onChange={(e) => setSendAddress(e.target.value)}
                      placeholder="0x..."
                      className="flex-1 px-4 py-3.5 bg-slate-800/60 border border-blue-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono text-sm"
                    />
                    <button
                      onClick={startScanner}
                      className="px-4 py-3.5 bg-slate-800/60 border border-blue-500/20 hover:border-cyan-500/40 rounded-xl transition-colors"
                    >
                      <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                    </button>
                  </div>

                  {/* My Wallets Quick Select */}
                  {allWallets.filter(w => w.id !== selectedWalletId).length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">Quick Select — My Wallets</p>
                      <div className="flex flex-wrap gap-2">
                        {allWallets
                          .filter(w => w.id !== selectedWalletId)
                          .map(wallet => (
                            <button
                              key={wallet.id}
                              onClick={() => setSendAddress(wallet.sponsor_address)}
                              className={`px-3 py-2 rounded-lg border transition-all text-xs ${
                                sendAddress.toLowerCase() === wallet.sponsor_address.toLowerCase()
                                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                                  : 'bg-slate-800/40 border-blue-500/20 text-gray-400 hover:border-purple-500/40 hover:text-purple-300'
                              }`}
                            >
                              <span className="font-medium">{wallet.wallet_name || 'Wallet'}</span>
                              <span className="ml-1.5 font-mono text-[10px] opacity-70">
                                {wallet.sponsor_address.slice(0, 6)}...{wallet.sponsor_address.slice(-4)}
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Amount</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.0001"
                      min="0"
                      className="w-full px-4 py-3.5 pr-24 bg-slate-800/60 border border-blue-500/20 rounded-xl text-white text-lg placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                      <button
                        onClick={() => {
                          const maxAmount = (Number(currentBalance.balance) / 1e18 - 0.001).toFixed(6);
                          setSendAmount(parseFloat(maxAmount) > 0 ? maxAmount : '0');
                        }}
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold px-2 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
                      >
                        MAX
                      </button>
                      <span className="text-gray-400 font-medium">{currentBalance.symbol}</span>
                    </div>
                  </div>
                </div>

                {/* Send Button */}
                <button
                  onClick={handleSend}
                  disabled={sending || !sendAddress || !sendAmount}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-2xl transition-all shadow-lg shadow-blue-500/25 disabled:shadow-none flex items-center justify-center space-x-2"
                >
                  {sending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      <span>Send {sendAmount ? `${sendAmount} ${currentBalance.symbol}` : 'Transaction'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Warning Card */}
            <div className="bg-slate-800/50 border border-amber-500/20 rounded-2xl p-4 backdrop-blur-sm">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-gray-300">
                  Transactions are <span className="text-amber-400 font-medium">irreversible</span>. Double-check the address and amount before sending.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* QR Scanner Modal */}
        {showScanner && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-blue-500/20 rounded-3xl p-6 max-w-sm w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Scan QR Code</h3>
                <button
                  onClick={stopScanner}
                  className="p-2 rounded-xl hover:bg-slate-700 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div
                id="qr-scanner"
                ref={scannerContainerRef}
                className="w-full aspect-square rounded-2xl overflow-hidden bg-black"
              />
              <p className="text-sm text-gray-400 text-center mt-4">
                Point your camera at a wallet address QR code
              </p>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
