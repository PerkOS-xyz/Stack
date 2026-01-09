'use client';

import { useState, useEffect, useRef } from 'react';
import { useActiveAccount, ConnectButton, darkTheme } from 'thirdweb/react';
import { client, chains } from '@/lib/config/thirdweb';
import { inAppWallet, createWallet } from 'thirdweb/wallets';
import { toast, Toaster } from 'sonner';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { RegistrationGuard } from '@/components/RegistrationGuard';

// Account type definitions
const ACCOUNT_TYPES = [
  {
    value: 'personal',
    label: 'Personal Account',
    description: 'Individual user account for personal use',
    icon: '👤',
  },
  {
    value: 'community',
    label: 'Community',
    description: 'Community member, contributor, or enthusiast',
    icon: '🌐',
  },
  {
    value: 'organization',
    label: 'Organization',
    description: 'Team or organization account',
    icon: '🏢',
  },
  {
    value: 'vendor',
    label: 'Company Vendor',
    description: 'Service provider or company account',
    icon: '🏪',
  },
] as const;

type AccountType = (typeof ACCOUNT_TYPES)[number]['value'];

interface UserProfile {
  id: string;
  wallet_address: string;
  account_type: AccountType;
  display_name: string | null;
  description: string | null;
  website: string | null;
  avatar_url: string | null;
  twitter_handle: string | null;
  github_handle: string | null;
  discord_handle: string | null;
  farcaster_handle: string | null;
  telegram_handle: string | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  twitch_handle: string | null;
  kick_handle: string | null;
  company_name: string | null;
  company_registration_number: string | null;
  is_verified: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

// Define wallets outside component
const supportedWallets = [
  createWallet('io.metamask'),
  createWallet('com.coinbase.wallet'),
  createWallet('me.rainbow'),
  createWallet('app.phantom'),
  createWallet('walletConnect'),
  inAppWallet({
    auth: {
      options: ['email', 'google', 'apple', 'facebook', 'discord', 'telegram', 'phone'],
    },
  }),
].filter(wallet => wallet && typeof wallet === 'object');

export default function ProfilePage() {
  const account = useActiveAccount();
  const address = account?.address;
  const isConnected = !!account;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileExists, setProfileExists] = useState(false);

  // Form state
  const [accountType, setAccountType] = useState<AccountType>('personal');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [githubHandle, setGithubHandle] = useState('');
  const [discordHandle, setDiscordHandle] = useState('');
  const [farcasterHandle, setFarcasterHandle] = useState('');
  const [telegramHandle, setTelegramHandle] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [tiktokHandle, setTiktokHandle] = useState('');
  const [twitchHandle, setTwitchHandle] = useState('');
  const [kickHandle, setKickHandle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyRegistrationNumber, setCompanyRegistrationNumber] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load profile when connected
  useEffect(() => {
    if (isConnected && address) {
      loadProfile();
    } else {
      setLoading(false);
    }
  }, [isConnected, address]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/profile?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        if (data.profile) {
          setProfileExists(true);
          populateForm(data.profile);
        } else {
          setProfileExists(false);
        }
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (profile: UserProfile) => {
    setAccountType(profile.account_type);
    setDisplayName(profile.display_name || '');
    setDescription(profile.description || '');
    setWebsite(profile.website || '');
    setAvatarUrl(profile.avatar_url || '');
    setTwitterHandle(profile.twitter_handle || '');
    setGithubHandle(profile.github_handle || '');
    setDiscordHandle(profile.discord_handle || '');
    setFarcasterHandle(profile.farcaster_handle || '');
    setTelegramHandle(profile.telegram_handle || '');
    setInstagramHandle(profile.instagram_handle || '');
    setTiktokHandle(profile.tiktok_handle || '');
    setTwitchHandle(profile.twitch_handle || '');
    setKickHandle(profile.kick_handle || '');
    setCompanyName(profile.company_name || '');
    setCompanyRegistrationNumber(profile.company_registration_number || '');
    setIsPublic(profile.is_public);
  };

  const handleSaveProfile = async () => {
    if (!address) return;

    setSaving(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          accountType,
          displayName,
          description,
          website,
          avatarUrl,
          twitterHandle,
          githubHandle,
          discordHandle,
          farcasterHandle,
          telegramHandle,
          instagramHandle,
          tiktokHandle,
          twitchHandle,
          kickHandle,
          companyName,
          companyRegistrationNumber,
          isPublic,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProfileExists(true);
        toast.success(data.message);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save profile');
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !address) return;

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 2MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('walletAddress', address);

      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setAvatarUrl(data.avatarUrl);
        toast.success('Avatar uploaded successfully');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to upload avatar');
      }
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!address) return;

    try {
      const response = await fetch(`/api/profile/avatar?address=${address}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAvatarUrl('');
        toast.success('Avatar removed');
      } else {
        toast.error('Failed to remove avatar');
      }
    } catch (error) {
      console.error('Failed to remove avatar:', error);
      toast.error('Failed to remove avatar');
    }
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
        <div className="fixed inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />
        <div className="relative flex items-center justify-center min-h-screen p-4">
          <div className="bg-slate-800/50 border border-blue-500/30 backdrop-blur-sm rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
            <div className="mb-6">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                Profile
              </h1>
              <p className="text-gray-300">
                Connect your wallet to manage your profile
              </p>
            </div>
            <ConnectButton
              client={client}
              chains={chains}
              wallets={supportedWallets}
              theme={darkTheme({
                colors: {
                  primaryButtonBg: 'linear-gradient(to right, #3b82f6, #06b6d4)',
                  primaryButtonText: '#ffffff',
                },
              })}
              connectButton={{
                label: 'Connect Wallet',
                style: {
                  width: '100%',
                  borderRadius: '8px',
                  fontWeight: '600',
                  padding: '12px 24px',
                },
              }}
              connectModal={{
                size: 'wide',
                title: 'Sign In',
                welcomeScreen: {
                  title: 'Stack Middleware',
                  subtitle: 'Multi-chain x402 payment infrastructure',
                },
                showThirdwebBranding: false,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <RegistrationGuard>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
        <Toaster position="top-right" richColors />
        <div className="fixed inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />

        <div className="relative">
          <Header />

        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Profile Settings
            </h1>
            <p className="text-gray-400 mt-2">
              {profileExists ? 'Update your profile information' : 'Set up your profile to get started'}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-cyan-400 border-r-transparent"></div>
              <span className="ml-3 text-gray-400">Loading profile...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Avatar & Account Type */}
              <div className="space-y-6">
                {/* Avatar Upload */}
                <div className="bg-slate-800/50 border border-blue-500/30 backdrop-blur-sm rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-cyan-400 mb-4">Avatar/Logo</h2>

                  <div className="flex flex-col items-center">
                    {/* Avatar Preview */}
                    <div className="relative mb-4">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Profile"
                          className="w-32 h-32 rounded-full object-cover border-4 border-blue-500/30"
                        />
                      ) : (
                        <div className="w-32 h-32 rounded-full bg-slate-700 border-4 border-blue-500/30 flex items-center justify-center">
                          <span className="text-4xl text-gray-500">
                            {accountType === 'personal' ? '👤' : accountType === 'community' ? '🌐' : accountType === 'organization' ? '🏢' : '🏪'}
                          </span>
                        </div>
                      )}
                      {uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-r-transparent"></div>
                        </div>
                      )}
                    </div>

                    {/* Upload Controls */}
                    <div className="flex gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                      >
                        {avatarUrl ? 'Change' : 'Upload'}
                      </button>
                      {avatarUrl && (
                        <button
                          onClick={handleRemoveAvatar}
                          className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium rounded-lg transition-all border border-red-500/30"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">PNG, JPG, GIF, WebP up to 2MB</p>
                  </div>
                </div>

                {/* Account Type Selection */}
                <div className="bg-slate-800/50 border border-blue-500/30 backdrop-blur-sm rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-cyan-400 mb-4">Account Type</h2>

                  <div className="space-y-3">
                    {ACCOUNT_TYPES.map((type) => (
                      <label
                        key={type.value}
                        className={`block p-4 rounded-lg border cursor-pointer transition-all ${
                          accountType === type.value
                            ? 'border-cyan-500 bg-cyan-500/10'
                            : 'border-slate-600 hover:border-slate-500 bg-slate-900/30'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <input
                            type="radio"
                            name="accountType"
                            value={type.value}
                            checked={accountType === type.value}
                            onChange={(e) => setAccountType(e.target.value as AccountType)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-xl">{type.icon}</span>
                              <span className="font-medium text-gray-200">{type.label}</span>
                            </div>
                            <p className="text-sm text-gray-400 mt-1">{type.description}</p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column - Profile Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Basic Information */}
                <div className="bg-slate-800/50 border border-blue-500/30 backdrop-blur-sm rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-cyan-400 mb-4">Basic Information</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Display Name */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Display Name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={accountType === 'vendor' ? 'Company Name' : 'Your Name'}
                        className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors"
                      />
                    </div>

                    {/* Website */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Website</label>
                      <input
                        type="url"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors"
                      />
                    </div>

                    {/* Description */}
                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-400 mb-2">Description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={
                          accountType === 'vendor'
                            ? 'Describe your services and offerings...'
                            : 'Tell us about yourself...'
                        }
                        rows={4}
                        className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Social Links */}
                <div className="bg-slate-800/50 border border-blue-500/30 backdrop-blur-sm rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-cyan-400 mb-4">Social Links</h2>

                  <div className="space-y-3">
                    {/* Row 1: Twitter, GitHub, Discord */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Twitter/X */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">
                          <span className="flex items-center space-x-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            <span>Twitter/X</span>
                          </span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
                          <input
                            type="text"
                            value={twitterHandle}
                            onChange={(e) => setTwitterHandle(e.target.value)}
                            placeholder="username"
                            className="w-full bg-slate-900/50 border border-slate-600 rounded-lg pl-7 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors"
                          />
                        </div>
                      </div>

                      {/* GitHub */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">
                          <span className="flex items-center space-x-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                            </svg>
                            <span>GitHub</span>
                          </span>
                        </label>
                        <input
                          type="text"
                          value={githubHandle}
                          onChange={(e) => setGithubHandle(e.target.value)}
                          placeholder="username"
                          className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors"
                        />
                      </div>

                      {/* Discord */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">
                          <span className="flex items-center space-x-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
                            </svg>
                            <span>Discord</span>
                          </span>
                        </label>
                        <input
                          type="text"
                          value={discordHandle}
                          onChange={(e) => setDiscordHandle(e.target.value)}
                          placeholder="username"
                          className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Row 2: Farcaster, Telegram, Instagram */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Farcaster */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">
                          <span className="flex items-center space-x-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M18.24 6.27H5.76v11.46h12.48V6.27zM12 2.64L2.64 6.27v11.46L12 21.36l9.36-3.63V6.27L12 2.64z"/>
                            </svg>
                            <span>Farcaster</span>
                          </span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
                          <input
                            type="text"
                            value={farcasterHandle}
                            onChange={(e) => setFarcasterHandle(e.target.value)}
                            placeholder="username"
                            className="w-full bg-slate-900/50 border border-slate-600 rounded-lg pl-7 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors"
                          />
                        </div>
                      </div>

                      {/* Telegram */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">
                          <span className="flex items-center space-x-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                            </svg>
                            <span>Telegram</span>
                          </span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
                          <input
                            type="text"
                            value={telegramHandle}
                            onChange={(e) => setTelegramHandle(e.target.value)}
                            placeholder="username"
                            className="w-full bg-slate-900/50 border border-slate-600 rounded-lg pl-7 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors"
                          />
                        </div>
                      </div>

                      {/* Instagram */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">
                          <span className="flex items-center space-x-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                            </svg>
                            <span>Instagram</span>
                          </span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
                          <input
                            type="text"
                            value={instagramHandle}
                            onChange={(e) => setInstagramHandle(e.target.value)}
                            placeholder="username"
                            className="w-full bg-slate-900/50 border border-slate-600 rounded-lg pl-7 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Row 3: TikTok, Twitch, Kick */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* TikTok */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">
                          <span className="flex items-center space-x-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                            </svg>
                            <span>TikTok</span>
                          </span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
                          <input
                            type="text"
                            value={tiktokHandle}
                            onChange={(e) => setTiktokHandle(e.target.value)}
                            placeholder="username"
                            className="w-full bg-slate-900/50 border border-slate-600 rounded-lg pl-7 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors"
                          />
                        </div>
                      </div>

                      {/* Twitch */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">
                          <span className="flex items-center space-x-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                            </svg>
                            <span>Twitch</span>
                          </span>
                        </label>
                        <input
                          type="text"
                          value={twitchHandle}
                          onChange={(e) => setTwitchHandle(e.target.value)}
                          placeholder="username"
                          className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors"
                        />
                      </div>

                      {/* Kick */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">
                          <span className="flex items-center space-x-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm3.5 16.5l-3-3-3 3-1.5-1.5 3-3-3-3 1.5-1.5 3 3 3-3 1.5 1.5-3 3 3 3-1.5 1.5z"/>
                            </svg>
                            <span>Kick</span>
                          </span>
                        </label>
                        <input
                          type="text"
                          value={kickHandle}
                          onChange={(e) => setKickHandle(e.target.value)}
                          placeholder="username"
                          className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vendor-specific Fields */}
                {accountType === 'vendor' && (
                  <div className="bg-slate-800/50 border border-purple-500/30 backdrop-blur-sm rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-purple-400 mb-4">
                      <span className="flex items-center space-x-2">
                        <span>🏪</span>
                        <span>Vendor Information</span>
                      </span>
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Company Name */}
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Company Name</label>
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Acme Inc."
                          className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-400 transition-colors"
                        />
                      </div>

                      {/* Registration Number */}
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Registration Number (Optional)</label>
                        <input
                          type="text"
                          value={companyRegistrationNumber}
                          onChange={(e) => setCompanyRegistrationNumber(e.target.value)}
                          placeholder="Company registration number"
                          className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-400 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Privacy Settings */}
                <div className="bg-slate-800/50 border border-blue-500/30 backdrop-blur-sm rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-cyan-400 mb-4">Profile Visibility</h2>

                  <div className="flex items-center justify-between">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-gray-200 font-medium">
                          {isPublic ? '🌍 Public Profile' : '🔒 Private Profile'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          isPublic
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-slate-600/50 text-gray-400 border border-slate-500/30'
                        }`}>
                          {isPublic ? 'Visible' : 'Hidden'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        {isPublic
                          ? 'Your profile will appear on the Contributors page and be visible to other users'
                          : 'Your profile is hidden from the Contributors page and other users'}
                      </p>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      onClick={() => setIsPublic(!isPublic)}
                      className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                        isPublic ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-slate-600'
                      }`}
                      role="switch"
                      aria-checked={isPublic}
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isPublic ? 'translate-x-7' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Info box */}
                  <div className={`mt-4 p-3 rounded-lg border ${
                    isPublic
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-slate-700/30 border-slate-600/50'
                  }`}>
                    <p className="text-xs text-gray-400">
                      {isPublic ? (
                        <>
                          <span className="text-green-400 font-medium">Public profiles</span> are displayed on the{' '}
                          <a href="/contributors" className="text-cyan-400 hover:underline">Contributors</a> page,
                          allowing other community members to discover and connect with you.
                        </>
                      ) : (
                        <>
                          <span className="text-gray-300 font-medium">Private profiles</span> are not listed publicly.
                          You can still use all platform features, but others won&apos;t find your profile in the directory.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center space-x-2"
                  >
                    {saving ? (
                      <>
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Save Profile</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
          </main>

          <Footer />
        </div>
      </div>
    </RegistrationGuard>
  );
}
