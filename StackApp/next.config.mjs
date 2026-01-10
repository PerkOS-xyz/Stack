/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Suppress source map requests for Para SDK files
  async rewrites() {
    return [
      {
        source: '/prime.worker.min.js.map',
        destination: '/api/empty-source-map',
      },
      {
        source: '/_next/static/css/app/capsule-core.css.map',
        destination: '/api/empty-source-map',
      },
    ];
  },
  // Allow build to continue even with errors
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable static generation for dynamic routes
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Custom webpack error handling
  webpack: (config, { isServer, dev }) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");

    // Stub Para SDK peer dependencies not needed for EVM-only usage
    config.resolve.alias = {
      ...config.resolve.alias,
      // Cosmos dependencies (not needed for EVM chains)
      '@cosmjs/stargate': false,
      '@cosmjs/proto-signing': false,
      '@cosmjs/amino': false,
      '@cosmjs/encoding': false,
      '@cosmjs/math': false,
      '@cosmjs/tendermint-rpc': false,
      '@cosmjs/crypto': false,
      'cosmjs-types': false,
      'graz': false,
      '@getpara/cosmos-wallet-connectors': false,
      '@getpara/cosmjs-v0-integration': false,
      '@getpara/graz-connector': false,
      // Solana dependencies (not needed for EVM chains)
      '@solana/wallet-adapter-base': false,
      '@solana/wallet-adapter-react': false,
      '@solana/wallet-adapter-wallets': false,
      '@solana/web3.js': false,
      '@getpara/solana-wallet-connectors': false,
    };

    // Fix for Para SDK + Next.js client-side compatibility
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Suppress build errors in production
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        emitOnErrors: true,
      };
    }

    return config;
  },
  // Handle build errors gracefully
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

export default nextConfig;
